import { z } from "zod";
import { chatJsonValidated, type LlmMessage } from "../../../lib/llm.ts";
import { ValidationError } from "../../../lib/errors.ts";
import type { PreconBill, PreconBoqRowDto, PreconProgrammeTask, PreconSheet } from "../pdf-takeoff/types.ts";
import {
  BOQ_ROW_CREATE_FIELDS,
  BOQ_ROW_UPDATE_FIELDS,
  CHANGE_ENTITIES,
  CHANGE_OPS,
  PROGRAMME_TASK_UPDATE_FIELDS,
  SHEET_UPDATE_FIELDS,
  VIEWER_FIELDS,
  VIEWER_TOOLS,
  VIEWER_ZOOMS,
  type AssistChange,
  type AssistSurface,
  type AssistViewerContext,
} from "./types.ts";

const MM_PER_PT_AT_1_TO_1 = 0.3528;
export const scaleRatioOf = (mmPerPt: number | null): number | null => (mmPerPt ? Math.round(mmPerPt / MM_PER_PT_AT_1_TO_1) : null);
export const mmPerPtForRatio = (ratio: number): number => ratio * MM_PER_PT_AT_1_TO_1;

const changeSchema = z.object({
  op: z.enum(CHANGE_OPS),
  entity: z.enum(CHANGE_ENTITIES),
  id: z.string().min(1).max(60).optional(),
  after: z.record(z.string(), z.unknown()),
});

// Models often send `"id": null` or `""` for changes that have no target (viewer) and
// omit `after` on deletes; both are legal shapes, so they are normalised
// before validation instead of failing it.
function normaliseDraftShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { changes?: unknown }).changes)) return raw;
  const changes = ((raw as { changes: unknown[] }).changes).map((c) => {
    if (!c || typeof c !== "object") return c;
    const change = { ...(c as Record<string, unknown>) };
    if (change["id"] === null || change["id"] === "") delete change["id"];
    if (change["after"] === null || change["after"] === undefined) change["after"] = {};
    return change;
  });
  return { ...(raw as object), changes };
}

const draftSchema = z.object({
  plan: z.array(z.string().min(1).max(300)).min(1).max(12),
  changes: z.array(changeSchema).max(80),
});
export const draftSchemaLoose = z.preprocess(normaliseDraftShape, draftSchema);

export type AssistDraft = z.infer<typeof draftSchema>;

// Injected so tests run without a provider; production uses the shared
// schema-validated completion with its repair retry.
export type DraftLlm = (messages: LlmMessage[]) => Promise<AssistDraft | null>;

export const defaultDraftLlm: DraftLlm = async (messages) => {
  const result = await chatJsonValidated(messages, draftSchemaLoose);
  return result?.data ?? null;
};

export interface BillContext {
  bills: PreconBill[];
  rows: PreconBoqRowDto[];
  sheets: PreconSheet[];
  viewer?: AssistViewerContext;
}

export interface ProgrammeContext {
  tasks: PreconProgrammeTask[];
}

const MAX_CONTEXT_ROWS = 400;

const SYSTEM_RULES = [
  "You are Panda AI, a quantity surveyor's assistant inside BuildPanda. The user asks for a change to an AI-drafted record; you answer with a short plan and a list of concrete changes.",
  "Respond with JSON only: {\"plan\": [\"...\"], \"changes\": [{\"op\": \"update\"|\"create\"|\"delete\", \"entity\": \"...\", \"id\": \"...\", \"after\": {...}}]}.",
  "The plan is 1 to 8 plain sentences a person reads before anything happens. Say what you will change and what you will leave alone. Mention any knock-on effect.",
  "Only reference ids that appear in the context. Never invent ids. Only set the allowed fields. Quantities and rates are numbers, never strings.",
  "If the request cannot be done with the allowed operations, return an empty changes list and explain why in the plan.",
];

function compactSheet(sheet: PreconSheet) {
  return {
    id: sheet.id,
    code: sheet.code,
    title: sheet.title,
    kind: sheet.kind,
    status: sheet.status,
    scaleRatio: scaleRatioOf(sheet.scaleMmPerPt),
    dimUnit: sheet.dimUnit,
    fileName: sheet.fileName,
  };
}

function compactRow(row: PreconBoqRowDto) {
  return {
    id: row.id,
    billId: row.billId,
    type: row.rowType,
    element: row.elementGroup,
    code: row.code,
    description: row.description,
    unit: row.unit,
    qty: row.qty,
    rate: row.rate,
    status: row.status,
  };
}

function compactTask(task: PreconProgrammeTask) {
  return {
    id: task.id,
    name: task.name,
    level: task.outlineLevel,
    durationDays: task.durationDays,
    isMilestone: task.isMilestone,
    basis: task.basis,
    status: task.status,
    predecessors: task.predecessors,
    startAt: task.startAt.slice(0, 10),
    finishAt: task.finishAt.slice(0, 10),
  };
}

export function buildBillMessages(prompt: string, ctx: BillContext): LlmMessage[] {
  const rows = ctx.rows.slice(0, MAX_CONTEXT_ROWS).map(compactRow);
  return [
    {
      role: "system",
      content: [
        ...SYSTEM_RULES,
        "Surface: the take-off review. Entities: \"boq_row\" (bill lines), \"sheet\" (the drawing sheets), \"viewer\" (the drawing viewer's tools).",
        `boq_row update: id required; allowed after fields: ${BOQ_ROW_UPDATE_FIELDS.join(", ")}. status may only be \"verified\" or \"rejected\".`,
        `boq_row create: allowed after fields: ${BOQ_ROW_CREATE_FIELDS.join(", ")}; billId required and must be one of the bills; rowType defaults to \"item\".`,
        "boq_row delete: id required. Only rows of type item or provisional_sum may be priced; headings and notes carry no qty or rate.",
        `sheet update: id is a sheet id; allowed after fields: ${SHEET_UPDATE_FIELDS.join(", ")}. kind is one of floor-plan, elevation, section, detail, schedule, unknown. scaleRatio is the drawing scale as a number, e.g. 100 for 1:100. dimUnit is mm, cm or m.`,
        `viewer update: no id; after fields: ${VIEWER_FIELDS.join(", ")}. tool is one of ${VIEWER_TOOLS.join(", ")} (area measures m², linear measures m, count counts items, deduct subtracts an opening, scale sets the scale by drawing a known length, select picks lines). sheetId switches the sheet shown. zoom is one of ${VIEWER_ZOOMS.join(", ")}. Use it when the user wants to measure, count, calibrate, zoom or look at a sheet themselves.`,
        "\"this sheet\" or \"the current sheet\" means context.viewer.activeSheetId. A request to measure or draw something the assistant cannot do itself becomes a viewer change that puts the right tool in the user's hand, with the plan telling them what to draw.",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        request: prompt,
        viewer: ctx.viewer ?? null,
        sheets: (ctx.sheets ?? []).map(compactSheet),
        bills: ctx.bills,
        rows,
        truncated: ctx.rows.length > rows.length,
      }),
    },
  ];
}

export function buildProgrammeMessages(prompt: string, ctx: ProgrammeContext): LlmMessage[] {
  const tasks = ctx.tasks.slice(0, MAX_CONTEXT_ROWS).map(compactTask);
  return [
    {
      role: "system",
      content: [
        ...SYSTEM_RULES,
        "Surface: the programme of work. Entity is always \"programme_task\".",
        `update: id required; allowed after fields: ${PROGRAMME_TASK_UPDATE_FIELDS.join(", ")}. status may only be \"verified\" or \"rejected\". predecessors is an array of {taskId, type: FS|SS|FF|SF, lagDays}.`,
        "create and delete are not available on this surface yet; if the request needs them, say so in the plan and propose the nearest update instead.",
        "Durations are working days. Keep milestones at zero duration. When you shorten a task, state the assumption in basis.",
      ].join("\n"),
    },
    { role: "user", content: JSON.stringify({ request: prompt, tasks, truncated: ctx.tasks.length > tasks.length }) },
  ];
}

function pick(source: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of allowed) if (key in source) out[key] = source[key];
  return out;
}

function requireStatus(after: Record<string, unknown>): void {
  if ("status" in after && after["status"] !== "verified" && after["status"] !== "rejected") {
    throw new ValidationError("Panda AI proposed a status other than verified or rejected");
  }
}

// Turns the model's draft into stored changes: every id must exist, every
// field must be allowed, and `before` + `label` are filled from the live
// record so the preview shows a real diff.
export function normaliseBillChanges(draft: AssistDraft, ctx: BillContext): AssistChange[] {
  const rowById = new Map(ctx.rows.map((r) => [r.id, r]));
  const billIds = new Set(ctx.bills.map((b) => b.id));
  const sheetById = new Map((ctx.sheets ?? []).map((s) => [s.id, s]));
  return draft.changes.map((change): AssistChange => {
    if (change.entity === "viewer") {
      if (change.op !== "update") throw new ValidationError("Panda AI proposed something other than an update to the viewer");
      const after = pick(change.after, VIEWER_FIELDS);
      if ("tool" in after && !(VIEWER_TOOLS as readonly unknown[]).includes(after["tool"])) {
        throw new ValidationError("Panda AI proposed a viewer tool that does not exist");
      }
      if ("sheetId" in after && !sheetById.has(String(after["sheetId"]))) {
        throw new ValidationError("Panda AI referenced a sheet that does not exist");
      }
      if ("zoom" in after && !(VIEWER_ZOOMS as readonly unknown[]).includes(after["zoom"])) {
        throw new ValidationError("Panda AI proposed a zoom that is not in, out or fit");
      }
      if (Object.keys(after).length === 0) throw new ValidationError("Panda AI proposed a viewer change with nothing in it");
      const before = { tool: ctx.viewer?.tool ?? null, sheetId: ctx.viewer?.activeSheetId ?? null };
      const sheet = "sheetId" in after ? sheetById.get(String(after["sheetId"])) : undefined;
      const label = [
        "tool" in after ? `Switch to the ${String(after["tool"])} tool` : null,
        sheet ? `show ${sheet.code ?? sheet.fileName}` : null,
        "zoom" in after ? `zoom ${String(after["zoom"])}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return { op: "update", entity: "viewer", before: pick(before, Object.keys(after)), after, label };
    }
    if (change.entity === "sheet") {
      if (change.op !== "update") throw new ValidationError("Sheets can only be updated by a prompt");
      const sheet = change.id ? sheetById.get(change.id) : undefined;
      if (!sheet) throw new ValidationError("Panda AI referenced a sheet that does not exist");
      const after = pick(change.after, SHEET_UPDATE_FIELDS);
      if ("scaleRatio" in after && !(typeof after["scaleRatio"] === "number" && after["scaleRatio"] > 0)) {
        throw new ValidationError("Panda AI proposed a scale that is not a positive number");
      }
      if (Object.keys(after).length === 0) throw new ValidationError("Panda AI proposed a sheet update with no allowed fields");
      const before = pick(compactSheet(sheet) as Record<string, unknown>, Object.keys(after));
      return { op: "update", entity: "sheet", id: sheet.id, before, after, label: `${sheet.code ?? sheet.fileName} · ${Object.keys(after).join(", ")}` };
    }
    if (change.entity !== "boq_row") throw new ValidationError(`Panda AI proposed a ${change.entity} change on the bill`);
    if (change.op === "create") {
      const after = pick(change.after, BOQ_ROW_CREATE_FIELDS);
      if (typeof after["billId"] !== "string" || !billIds.has(after["billId"])) {
        throw new ValidationError("Panda AI proposed a new line on a bill that does not exist");
      }
      if (typeof after["description"] !== "string" || after["description"].trim() === "") {
        throw new ValidationError("Panda AI proposed a new line with no description");
      }
      return { op: "create", entity: "boq_row", after, label: `New line · ${after["description"]}` };
    }
    const row = change.id ? rowById.get(change.id) : undefined;
    if (!row) throw new ValidationError("Panda AI referenced a bill line that does not exist");
    if (change.op === "delete") {
      return { op: "delete", entity: "boq_row", id: row.id, before: compactRow(row), after: {}, label: `Delete · ${row.description}` };
    }
    const after = pick(change.after, BOQ_ROW_UPDATE_FIELDS);
    requireStatus(after);
    if (Object.keys(after).length === 0) throw new ValidationError("Panda AI proposed an update with no allowed fields");
    const before = pick(compactRow(row) as Record<string, unknown>, Object.keys(after));
    return { op: "update", entity: "boq_row", id: row.id, before, after, label: `${row.description} · ${Object.keys(after).join(", ")}` };
  });
}

export function normaliseProgrammeChanges(draft: AssistDraft, ctx: ProgrammeContext): AssistChange[] {
  const taskById = new Map(ctx.tasks.map((t) => [t.id, t]));
  return draft.changes.map((change) => {
    if (change.entity !== "programme_task") {
      throw new ValidationError(`Panda AI proposed a ${change.entity} change on the programme`);
    }
    if (change.op !== "update") throw new ValidationError("Panda AI proposed creating or deleting a programme task, which is not available yet");
    const task = change.id ? taskById.get(change.id) : undefined;
    if (!task) throw new ValidationError("Panda AI referenced a programme task that does not exist");
    const after = pick(change.after, PROGRAMME_TASK_UPDATE_FIELDS);
    requireStatus(after);
    if (Object.keys(after).length === 0) throw new ValidationError("Panda AI proposed an update with no allowed fields");
    const before = pick(compactTask(task) as Record<string, unknown>, Object.keys(after));
    return { op: "update", entity: "programme_task", id: task.id, before, after, label: `${task.name} · ${Object.keys(after).join(", ")}` };
  });
}

export function messagesFor(surface: AssistSurface, prompt: string, ctx: BillContext | ProgrammeContext): LlmMessage[] {
  return surface === "bill"
    ? buildBillMessages(prompt, ctx as BillContext)
    : buildProgrammeMessages(prompt, ctx as ProgrammeContext);
}
