import { z } from "zod";
import type { Knex } from "knex";
import { generateId } from "../../../../lib/ids.ts";
import { chatJsonValidated, isLlmConfigured, type LlmMessage } from "../../../../lib/llm.ts";
import { preconRepository } from "../repository.ts";
import type {
  PreconBoqRowRow,
  PreconProgrammeTaskRow,
  ProgrammeDependency,
} from "../types.ts";

// Drafts the programme of work from the BOQ the same drawings produced. The BOQ
// is the right input rather than the drawings themselves: it already states what
// is being built and how much of it, which is exactly what a planner sequences.

const taskSchema = z.object({
  ref: z.string().min(1).max(20),
  name: z.string().min(3).max(120),
  elementGroup: z.string().max(60).nullable().optional(),
  outlineLevel: z.number().int().min(1).max(3),
  durationDays: z.number().min(0).max(400),
  isMilestone: z.boolean(),
  basis: z.string().max(200),
  predecessors: z
    .array(
      z.object({
        ref: z.string().min(1).max(20),
        type: z.enum(["FS", "SS", "FF", "SF"]),
        lagDays: z.number().min(-60).max(60),
      }),
    )
    .max(4)
    .optional(),
});

const programmeSchema = z.object({ tasks: z.array(taskSchema).min(1).max(120) });

export type ProgrammeDraft = z.infer<typeof programmeSchema>;

/** One line per element so the planner sees scope and scale, not 400 BOQ rows. */
function summariseBoq(rows: PreconBoqRowRow[]): string {
  const byElement = new Map<string, { items: number; measures: string[] }>();
  for (const row of rows) {
    if (row.status === "rejected") continue;
    if (row.row_type !== "item" && row.row_type !== "provisional_sum") continue;
    const key = row.element_group ?? "General";
    const entry = byElement.get(key) ?? { items: 0, measures: [] };
    entry.items += 1;
    if (entry.measures.length < 6 && row.qty !== null && row.unit) {
      entry.measures.push(`${row.description.slice(0, 70)} — ${row.qty}${row.unit}`);
    }
    byElement.set(key, entry);
  }
  return [...byElement.entries()]
    .map(([element, e]) => `${element} (${e.items} items)\n  ${e.measures.join("\n  ")}`)
    .join("\n");
}

function messages(boqSummary: string, projectTitle: string): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are a Nigerian construction planner drafting a tender programme of work from a Bill of Quantities.",
        "Produce a buildable sequence, not a list of the BOQ elements in the order given.",
        "RULES:",
        "1. Follow real construction logic: site setup and substructure precede superstructure; the frame precedes roofing; the building must be weather-tight before internal finishes; external works and snagging finish last.",
        "2. Use outlineLevel 1 for a phase (e.g. 'Substructure') and outlineLevel 2 for the work packages inside it. A level-1 phase carries no duration of its own — set its durationDays to 0; its span comes from its children.",
        "3. durationDays must be justified in `basis` from the measured quantity and a stated output rate, e.g. '320m2 blockwork at 12m2/mason-day, 4 masons'. Never invent a duration you cannot defend.",
        "4. Link work packages with predecessors using `ref`. Prefer finish-to-start (FS). Use SS with a lag where trades genuinely overlap (e.g. services first fix alongside blockwork). Every task except the first should have at least one predecessor.",
        "5. Add milestones (isMilestone true, durationDays 0) for the contractual moments: site possession, substructure complete, roof watertight, practical completion.",
        "6. Durations are in WORKING days and exclude weekends.",
        "Respond with JSON only: {\"tasks\":[{\"ref\":\"t1\",\"name\":\"...\",\"elementGroup\":\"...\",\"outlineLevel\":1,\"durationDays\":0,\"isMilestone\":false,\"basis\":\"...\",\"predecessors\":[{\"ref\":\"t0\",\"type\":\"FS\",\"lagDays\":0}]}]}",
      ].join("\n"),
    },
    {
      role: "user",
      content: `PROJECT: ${projectTitle}\n\nMEASURED BILL OF QUANTITIES BY ELEMENT:\n${boqSummary}`,
    },
  ];
}

export interface GenerateProgrammeResult {
  taskCount: number;
  usedAi: boolean;
}

export async function generateProgrammeForSession(
  db: Knex,
  sessionId: string,
  projectTitle: string,
  onProgress: (message: string) => void = () => {},
): Promise<GenerateProgrammeResult> {
  const repo = preconRepository(db);
  const rows = await repo.rowsBySession(sessionId);
  const summary = summariseBoq(rows);
  if (!summary.trim()) {
    throw new Error("This session has no measured BOQ items to build a programme from.");
  }
  if (!isLlmConfigured()) {
    throw new Error("Programme generation needs an LLM provider; none is configured.");
  }

  onProgress("Sequencing work packages from the bill of quantities");
  const response = await chatJsonValidated(messages(summary, projectTitle), programmeSchema);
  if (!response) throw new Error("The planner returned no programme.");

  const draft = response.data.tasks;

  // Map the model's own refs onto real ids, then resolve links through that map.
  // A ref the model invented but never defined is dropped rather than persisted
  // as a dangling dependency, which would break scheduling and the MSPDI export.
  const idByRef = new Map<string, string>();
  for (const task of draft) idByRef.set(task.ref, generateId("ppt"));

  const parentStack: Array<{ level: number; id: string }> = [];
  const tasks: Omit<PreconProgrammeTaskRow, "created_at" | "updated_at">[] = draft.map(
    (task, index) => {
      const id = idByRef.get(task.ref)!;
      while (parentStack.length && parentStack[parentStack.length - 1]!.level >= task.outlineLevel) {
        parentStack.pop();
      }
      const parentTaskId = parentStack.length ? parentStack[parentStack.length - 1]!.id : null;
      parentStack.push({ level: task.outlineLevel, id });

      const predecessors: ProgrammeDependency[] = (task.predecessors ?? []).flatMap((link) => {
        const target = idByRef.get(link.ref);
        return target && target !== id
          ? [{ taskId: target, type: link.type, lagDays: link.lagDays }]
          : [];
      });

      return {
        id,
        session_id: sessionId,
        sort: index,
        name: task.name,
        element_group: task.elementGroup ?? null,
        wbs_code: null,
        outline_level: task.outlineLevel,
        parent_task_id: parentTaskId,
        duration_days: task.isMilestone ? 0 : task.durationDays,
        predecessors,
        is_milestone: task.isMilestone,
        basis: task.basis,
        confidence: task.durationDays > 0 || task.isMilestone ? "high" : "low",
        status: task.durationDays > 0 || task.isMilestone ? "ai_generated" : "needs_review",
        version: 1,
        verified_by: null,
        verified_at: null,
      };
    },
  );

  await repo.replaceProgrammeTasks(sessionId, tasks);
  onProgress(`Programme drafted: ${tasks.length} tasks`);
  return { taskCount: tasks.length, usedAi: true };
}
