import { z } from "zod";
import { pandaAiJson, isPandaAiConfigured } from "../engine.ts";
import type { ParsedProgramme, ProgrammeTask, DependencyType } from "./parser.ts";

const aiGroupingSchema = z.object({
  projectName: z.string().optional(),
  phases: z.array(z.object({ name: z.string().optional() })).optional(),
  assignments: z
    .array(z.object({ refId: z.string().optional(), phase: z.string().optional(), isMilestone: z.boolean().optional() }))
    .optional(),
});

export interface StructuredActivity {
  refId: string;
  name: string;
  phaseKey: string;
  wbsCode: string | null;
  outlineLevel: number;
  parentRefId: string | null;
  startAt: string;
  endAt: string;
  durationDays: number | null;
  percentComplete: number;
  isSummary: boolean;
  isMilestone: boolean;
  predecessors: Array<{ refId: string; type: DependencyType; lagDays: number }>;
  cost: number;
}

export interface StructuredPhase {
  key: string;
  name: string;
  sort: number;
}

export interface StructuredProgramme {
  projectName: string;
  startAt: string | null;
  endAt: string | null;
  sourceTaskCount: number;
  skippedTaskCount: number;
  summaryActivityCount: number;
  phases: StructuredPhase[];
  activities: StructuredActivity[];
  usedAi: boolean;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "phase";
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.round(days)));
  return d.toISOString();
}

function resolveDates(task: ProgrammeTask): { startAt: string; endAt: string } {
  const start = task.start ?? task.finish ?? new Date().toISOString();
  let end = task.finish ?? task.start ?? start;
  if (task.start && !task.finish && task.durationDays) end = addDays(task.start, task.durationDays);
  if (new Date(end) < new Date(start)) end = start;
  return { startAt: start, endAt: end };
}

function structureFromHierarchy(parsed: ParsedProgramme, projectName: string): StructuredProgramme {
  const phases: StructuredPhase[] = [];
  const phaseByKey = new Map<string, StructuredPhase>();
  const activities: StructuredActivity[] = [];
  const taskByWbs = new Map(parsed.tasks.filter((t) => t.wbs).map((t) => [t.wbs, t]));

  function wbsTopKey(wbs: string): string {
    return wbs.split(".")[0] ?? wbs;
  }

  const topSummaries = new Map<string, ProgrammeTask>();
  for (const t of parsed.tasks) {
    if (t.outlineLevel === 1) topSummaries.set(wbsTopKey(t.wbs), t);
  }

  function ensurePhase(task: ProgrammeTask): string {
    const topKey = wbsTopKey(task.wbs);
    const summary = topSummaries.get(topKey);
    const name = summary ? summary.name : "General";
    const key = slug(`${topKey}-${name}`);
    if (!phaseByKey.has(key)) {
      const phase: StructuredPhase = { key, name, sort: phases.length };
      phases.push(phase);
      phaseByKey.set(key, phase);
    }
    return key;
  }

  function parentRefId(task: ProgrammeTask): string | null {
    const wbs = task.wbs;
    const lastDot = wbs.lastIndexOf(".");
    if (lastDot <= 0) return null;
    return taskByWbs.get(wbs.slice(0, lastDot))?.refId ?? null;
  }

  for (const task of parsed.tasks) {
    const phaseKey = ensurePhase(task);
    const { startAt, endAt } = resolveDates(task);
    activities.push({
      refId: task.refId,
      name: task.name,
      phaseKey,
      wbsCode: task.wbs || null,
      outlineLevel: task.outlineLevel,
      parentRefId: parentRefId(task),
      startAt,
      endAt,
      durationDays: task.durationDays,
      percentComplete: task.percentComplete,
      isSummary: task.isSummary,
      isMilestone: task.isMilestone,
      predecessors: task.predecessors,
      cost: task.cost,
    });
  }

  if (phases.length === 0) {
    phases.push({ key: "general", name: "General", sort: 0 });
    for (const a of activities) a.phaseKey = "general";
  }

  return {
    projectName,
    startAt: parsed.start,
    endAt: parsed.finish,
    sourceTaskCount: parsed.sourceTaskCount,
    skippedTaskCount: parsed.skippedTaskCount,
    summaryActivityCount: activities.filter((activity) => activity.isSummary).length,
    phases,
    activities,
    usedAi: false,
  };
}

const GROUPING_SYSTEM = [
  "You are Panda AI, a construction programme analyst.",
  "Given a flat list of construction schedule tasks, group them into a small set of logical project phases",
  "(typically 4-10 phases such as Site Setup, Substructure, Superstructure, Services, Finishes, External Works, Handover).",
  "Also flag any task that is a milestone (zero-duration checkpoints, approvals, completions, sign-offs).",
  'Respond ONLY with JSON: {"projectName": string, "phases": [{"name": string}], "assignments": [{"refId": string, "phase": string, "isMilestone": boolean}]}.',
  "Every task refId from the input MUST appear exactly once in assignments. phase MUST match one of the phases names.",
].join(" ");

async function structureWithAi(
  parsed: ParsedProgramme,
  fallbackName: string,
): Promise<StructuredProgramme> {
  const taskLines = parsed.tasks.map((t) => ({
    refId: t.refId,
    name: t.name,
    durationDays: t.durationDays,
    start: t.start,
    finish: t.finish,
  }));
  const user = JSON.stringify({ projectName: parsed.projectName, tasks: taskLines });
  const ai = await pandaAiJson(GROUPING_SYSTEM, user, aiGroupingSchema);

  if (!ai?.phases?.length || !ai.assignments?.length) {
    return structureFlatFallback(parsed, fallbackName);
  }

  const phases: StructuredPhase[] = ai.phases
    .map((p) => (p.name ?? "").trim())
    .filter(Boolean)
    .map((name, i) => ({ key: slug(name), name, sort: i }));
  const phaseKeys = new Set(phases.map((p) => p.key));
  if (phases.length === 0) return structureFlatFallback(parsed, fallbackName);

  const assignmentByRef = new Map<string, { phaseKey: string; isMilestone: boolean }>();
  for (const a of ai.assignments) {
    const refId = String(a.refId ?? "");
    const key = slug(String(a.phase ?? ""));
    if (refId && phaseKeys.has(key)) {
      assignmentByRef.set(refId, { phaseKey: key, isMilestone: Boolean(a.isMilestone) });
    }
  }

  const fallbackKey = phases[0]!.key;
  const activities: StructuredActivity[] = parsed.tasks.map((task) => {
    const assigned = assignmentByRef.get(task.refId);
    const { startAt, endAt } = resolveDates(task);
    return {
      refId: task.refId,
      name: task.name,
      phaseKey: assigned?.phaseKey ?? fallbackKey,
      wbsCode: task.wbs || null,
      outlineLevel: task.outlineLevel,
      parentRefId: null,
      startAt,
      endAt,
      durationDays: task.durationDays,
      percentComplete: task.percentComplete,
      isSummary: task.isSummary,
      isMilestone: task.isMilestone || Boolean(assigned?.isMilestone),
      predecessors: task.predecessors,
      cost: task.cost,
    };
  });

  return {
    projectName: (ai.projectName ?? parsed.projectName ?? fallbackName).trim() || fallbackName,
    startAt: parsed.start,
    endAt: parsed.finish,
    sourceTaskCount: parsed.sourceTaskCount,
    skippedTaskCount: parsed.skippedTaskCount,
    summaryActivityCount: activities.filter((activity) => activity.isSummary).length,
    phases,
    activities,
    usedAi: true,
  };
}

function structureFlatFallback(parsed: ParsedProgramme, fallbackName: string): StructuredProgramme {
  const activities: StructuredActivity[] = parsed.tasks.map((task) => {
    const { startAt, endAt } = resolveDates(task);
    return {
      refId: task.refId,
      name: task.name,
      phaseKey: "general",
      wbsCode: task.wbs || null,
      outlineLevel: task.outlineLevel,
      parentRefId: null,
      startAt,
      endAt,
      durationDays: task.durationDays,
      percentComplete: task.percentComplete,
      isSummary: task.isSummary,
      isMilestone: task.isMilestone,
      predecessors: task.predecessors,
      cost: task.cost,
    };
  });
  return {
    projectName: parsed.projectName ?? fallbackName,
    startAt: parsed.start,
    endAt: parsed.finish,
    sourceTaskCount: parsed.sourceTaskCount,
    skippedTaskCount: parsed.skippedTaskCount,
    summaryActivityCount: activities.filter((activity) => activity.isSummary).length,
    phases: [{ key: "general", name: "General", sort: 0 }],
    activities,
    usedAi: false,
  };
}

export async function structureProgramme(
  parsed: ParsedProgramme,
  fallbackName: string,
): Promise<StructuredProgramme> {
  if (parsed.tasks.length === 0) {
    return {
      projectName: parsed.projectName ?? fallbackName,
      startAt: null,
      endAt: null,
      sourceTaskCount: parsed.sourceTaskCount,
      skippedTaskCount: parsed.skippedTaskCount,
      summaryActivityCount: 0,
      phases: [],
      activities: [],
      usedAi: false,
    };
  }

  const hasHierarchy = parsed.tasks.some((t) => t.outlineLevel >= 2 || t.wbs.includes("."));
  if (hasHierarchy) {
    return structureFromHierarchy(parsed, parsed.projectName ?? fallbackName);
  }

  if (isPandaAiConfigured()) {
    return structureWithAi(parsed, fallbackName);
  }

  return structureFlatFallback(parsed, fallbackName);
}
