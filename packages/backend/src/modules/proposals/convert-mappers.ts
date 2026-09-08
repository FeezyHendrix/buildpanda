import { generateId } from "../../lib/ids.ts";
import type { PreconBoqRowDto, PreconProgrammeTask, StructureContext } from "../panda-ai/pdf-takeoff/types.ts";
import type { EstimateItem, PaymentScheduleItem, ProposalPlan } from "./types.ts";
import type { ConvertProgrammeSeed, ConvertMaterialSeed, ConvertPlanSeed, JobProfile } from "./types.ts";

const MS_PER_DAY = 86_400_000;
export const round2 = (n: number): number => Math.round(n * 100) / 100;
const isoDate = (iso: string): string => iso.slice(0, 10);
const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_DAY);

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Estimate sections → budget categories: each distinct estimate group
 * (in first-appearance order) becomes a planned budget category whose amount
 * is the sum of its line-item totals. Contingency, when set, becomes its own
 * category so the planned budget matches the estimate's pre-tax subtotal.
 */
export function buildBudgetCategories(
  projectId: string,
  items: EstimateItem[],
  contingencyPct: number,
): Array<Record<string, unknown>> {
  const byGroup = new Map<string, number>();
  for (const item of items) {
    byGroup.set(item.groupLabel, (byGroup.get(item.groupLabel) ?? 0) + item.total);
  }
  const categories = [...byGroup.entries()].map(([name, planned], idx) => ({
    id: generateId("budgetcat"),
    project_id: projectId,
    name,
    cost_code: null,
    planned: round2(planned),
    committed: 0,
    actual: 0,
    notes: "Seeded from the accepted estimate.",
    sort_order: idx,
  }));
  if (contingencyPct > 0 && items.length > 0) {
    const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
    categories.push({
      id: generateId("budgetcat"),
      project_id: projectId,
      name: "Contingency",
      cost_code: null,
      planned: round2((itemsSubtotal * contingencyPct) / 100),
      committed: 0,
      actual: 0,
      notes: `Estimate contingency (${contingencyPct}%).`,
      sort_order: categories.length,
    });
  }
  return categories;
}

/** Walks parent links up to the outline-level-1 task that owns a task. */
function stageTaskOf(task: PreconProgrammeTask, byId: Map<string, PreconProgrammeTask>): PreconProgrammeTask | null {
  let current: PreconProgrammeTask | undefined = task;
  while (current && current.outlineLevel > 1) {
    current = current.parentTaskId ? byId.get(current.parentTaskId) : undefined;
  }
  return current && current.outlineLevel === 1 ? current : null;
}

/**
 * Verified programme → stages, activities and key dates. Outline level 1 tasks
 * become stages; everything deeper becomes an activity under its stage with
 * dependencies rewritten to activity ids; milestones become key dates. The
 * stage set is therefore derived from the take-off's scope, never a fixed list.
 */
export function programmeToSeed(
  input: { startDate: string; finishDate: string | null; tasks: PreconProgrammeTask[] },
  ids: { projectId: string; buildingId: string; ownerId: string },
): ConvertProgrammeSeed {
  const tasks = input.tasks.filter((t) => t.status !== "rejected");
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const phaseIdByTaskId = new Map<string, string>();
  const activityIdByTaskId = new Map<string, string>();
  for (const task of tasks) {
    if (task.outlineLevel === 1 && !task.isMilestone) phaseIdByTaskId.set(task.id, generateId("phase"));
    else activityIdByTaskId.set(task.id, generateId("act"));
  }

  const phases = tasks
    .filter((t) => phaseIdByTaskId.has(t.id))
    .map((stage, idx) => {
      const children = tasks.filter((t) => t.id !== stage.id && stageTaskOf(t, byId)?.id === stage.id);
      const span = children.length > 0 ? children : [stage];
      const start = span.reduce((min, t) => (t.startAt < min ? t.startAt : min), span[0]!.startAt);
      const end = span.reduce((max, t) => (t.finishAt > max ? t.finishAt : max), span[0]!.finishAt);
      return {
        id: phaseIdByTaskId.get(stage.id)!,
        project_id: ids.projectId,
        building_id: ids.buildingId,
        name: stage.name,
        status: "Pending",
        date_range: `${shortDate.format(new Date(start))} – ${shortDate.format(new Date(end))}`,
        start_date: isoDate(start),
        end_date: isoDate(end),
        sort_order: idx,
        programme_task_id: stage.id,
      };
    });

  const activities = tasks
    .filter((t) => activityIdByTaskId.has(t.id))
    .map((task) => {
      const stage = stageTaskOf(task, byId);
      const parentActivity = task.parentTaskId ? activityIdByTaskId.get(task.parentTaskId) ?? null : null;
      const predecessors = task.predecessors.flatMap((p) => {
        const activityId = activityIdByTaskId.get(p.taskId);
        return activityId ? [{ activityId, type: p.type, lagDays: p.lagDays }] : [];
      });
      return {
        id: activityIdByTaskId.get(task.id)!,
        project_id: ids.projectId,
        building_id: ids.buildingId,
        phase_id: stage ? phaseIdByTaskId.get(stage.id) ?? null : null,
        name: task.name,
        activity_type: task.isMilestone ? "Milestone" : "Construction",
        location: null,
        status: "Planned",
        planned_start_at: task.startAt,
        planned_end_at: task.finishAt,
        worker_count_planned: 0,
        notes: task.basis,
        wbs_code: task.wbsCode,
        outline_level: task.outlineLevel,
        parent_activity_id: parentActivity,
        predecessors: JSON.stringify(predecessors),
        percent_complete: 0,
        duration_days: task.durationDays,
        baseline_start_at: task.startAt,
        baseline_end_at: task.finishAt,
        is_milestone: task.isMilestone,
        source: "proposal-handoff",
        created_by_id: ids.ownerId,
        programme_task_id: task.id,
      };
    });

  const keyDates: ConvertProgrammeSeed["keyDates"] = [];
  const seen = new Set<string>();
  const push = (label: string, iso: string | null, taskId: string | null) => {
    if (!iso) return;
    const key = `${label}|${isoDate(iso)}`;
    if (seen.has(key)) return;
    seen.add(key);
    keyDates.push({
      id: generateId("kd"),
      project_id: ids.projectId,
      building_id: ids.buildingId,
      label,
      target_date: isoDate(iso),
      actual_date: null,
      status: "Upcoming",
      notes: null,
      sort_order: keyDates.length,
      programme_task_id: taskId,
    });
  };
  push("Project start", input.startDate, null);
  for (const task of tasks.filter((t) => t.isMilestone)) push(task.name, task.finishAt, task.id);
  for (const phase of phases) push(`${phase.name} complete`, `${phase.end_date}T00:00:00.000Z`, phase.programme_task_id);
  push("Project completion", input.finishDate, null);

  return { phases, activities, keyDates, phaseIdByTaskId, activityIdByTaskId };
}

/**
 * Payment schedule → milestone payments. A stage bound to a programme task
 * lands on that task's stage; unbound stages stay "General" on the shared
 * building. Every row keeps its schedule item id.
 */
export function scheduleToMilestones(
  schedule: PaymentScheduleItem[],
  estimateTotal: number,
  ctx: {
    projectId: string;
    sharedBuildingId: string;
    phaseByTaskId: Map<string, { id: string; name: string; building_id: string }>;
    tasksById: Map<string, PreconProgrammeTask>;
  },
): Array<Record<string, unknown>> {
  return schedule.map((s, idx) => {
    const taskId = (s as PaymentScheduleItem & { programmeTaskId?: string | null }).programmeTaskId ?? null;
    const task = taskId ? ctx.tasksById.get(taskId) : undefined;
    const stageTask = task ? stageTaskOf(task, ctx.tasksById) : null;
    const phase = stageTask ? ctx.phaseByTaskId.get(stageTask.id) : undefined;
    return {
      id: generateId("mlst"),
      project_id: ctx.projectId,
      building_id: phase?.building_id ?? ctx.sharedBuildingId,
      name: s.label,
      phase: phase?.name ?? "General",
      status: "Pending",
      percent_complete: 0,
      amount: round2((estimateTotal * s.percent) / 100),
      proof_file_name: null,
      proof_verified: false,
      inspector_sign_off: "Pending",
      sort_order: idx,
      schedule_item_id: s.id,
    };
  });
}

const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Verified take-off lines → draft material orders (the procurement schedule).
 * needed_by is the planned start of the activity that shares the line's
 * element group, else the project start; long-lead when the catalogue lead
 * time exceeds the days left before that start.
 */
export function rowsToMaterialOrders(
  rows: PreconBoqRowDto[],
  ctx: {
    projectId: string;
    currency: string;
    startDate: string;
    sessionTitle: string;
    jobProfile: JobProfile;
    activities: ConvertProgrammeSeed["activities"];
    tasksById: Map<string, PreconProgrammeTask>;
    leadTimeByName: Map<string, number>;
  },
): ConvertMaterialSeed {
  const owner = ctx.jobProfile === "labour_only" ? "client" : "contractor";
  const today = new Date().toISOString();
  let longLead = 0;
  const orders = rows
    .filter((r) => (r.rowType === "item" || r.rowType === "provisional_sum") && r.status !== "rejected" && (r.qty ?? 0) > 0)
    .map((row) => {
      const activity = ctx.activities.find((a) => {
        const task = ctx.tasksById.get(a.programme_task_id);
        return task?.elementGroup && row.elementGroup && normalise(task.elementGroup) === normalise(row.elementGroup);
      });
      const neededBy = activity ? String(activity.planned_start_at) : ctx.startDate;
      const leadTime = ctx.leadTimeByName.get(normalise(row.description)) ?? null;
      const isLongLead = leadTime !== null && leadTime > daysBetween(today, neededBy);
      if (isLongLead) longLead++;
      return {
        id: generateId("mo"),
        project_id: ctx.projectId,
        title: row.description.slice(0, 120),
        material_name: row.description,
        quantity: row.qty ?? 0,
        unit: row.unit ?? "item",
        supplier: null,
        status: "Draft",
        priority: isLongLead ? "High" : "Normal",
        phase_id: activity?.phase_id ?? null,
        activity_id: activity?.id ?? null,
        needed_by: isoDate(neededBy),
        estimated_cost: row.amount ?? 0,
        actual_cost: 0,
        currency: ctx.currency,
        notes: `Seeded from take-off "${ctx.sessionTitle}"${isLongLead ? ` · long lead (${leadTime} days)` : ""}`,
        takeoff_row_id: row.id,
        owner,
      };
    });
  return { orders, longLeadCount: longLead };
}

const PLAN_CATEGORY: Record<string, string> = {
  architectural: "cat_plan_architectural",
  structural: "cat_plan_structural",
  mep: "cat_plan_mep",
  civil: "cat_plan_civil",
  survey: "cat_plan_survey",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Proposal drawings → project documents in the plan category, one version per revision. */
export function plansToDocuments(
  plans: ProposalPlan[],
  ctx: { projectId: string; uploadedBy: string; now: string },
): ConvertPlanSeed {
  const documents: ConvertPlanSeed["documents"] = [];
  const versions: ConvertPlanSeed["versions"] = [];
  for (const plan of plans) {
    const extra = plan as ProposalPlan & { discipline?: string | null; revision?: string | null; revisionStatus?: string | null };
    if (extra.revisionStatus === "superseded") continue;
    const docId = generateId("doc");
    const versionId = generateId("dver");
    documents.push({
      id: docId,
      project_id: ctx.projectId,
      category_id: PLAN_CATEGORY[extra.discipline ?? ""] ?? "cat_plan_architectural",
      file_id: plan.fileId,
      file_name: plan.fileName,
      size: formatBytes(plan.sizeBytes),
      size_bytes: plan.sizeBytes,
      status: "Verified",
      uploaded_at: ctx.now,
      current_version_id: versionId,
    });
    versions.push({
      id: versionId,
      document_id: docId,
      file_id: plan.fileId,
      version_no: 1,
      revision_label: extra.revision ?? null,
      file_name: plan.fileName,
      size: formatBytes(plan.sizeBytes),
      size_bytes: plan.sizeBytes,
      notes: `From proposal drawing ${plan.id}`,
      uploaded_by_id: ctx.uploadedBy,
    });
  }
  return { documents, versions };
}

/** Areas-scope take-off lines → one open finishes selection per space. */
export function areasToSelections(
  rows: PreconBoqRowDto[],
  ctx: { projectId: string; currency: string; createdBy: string },
): Array<Record<string, unknown>> {
  return rows
    .filter((r) => r.elementGroup === "Measured areas" && r.status !== "rejected")
    .map((row) => {
      const space = row.description.replace(/\s*[—-]\s*floor area$/i, "");
      return {
        id: generateId("sel"),
        project_id: ctx.projectId,
        title: `${space} finishes`,
        description: `Floor area ${row.qty ?? 0} ${row.unit ?? "m2"}, measured by Panda AI.`,
        category: "Finishes",
        allowance_amount: null,
        currency: ctx.currency,
        due_date: null,
        status: "open",
        created_by_id: ctx.createdBy,
      };
    });
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Project setup from the take-off's structure reading, not a hardcoded house. */
export function setupFromStructure(
  ctx: StructureContext | null,
  location: string | null,
  programmeWeeks: number | null,
): Record<string, unknown> {
  const buildingType = ctx?.buildingType ? capitalise(ctx.buildingType) : "House";
  const commercial = /office|commercial|retail|warehouse|hotel|school|hospital/i.test(ctx?.buildingType ?? "");
  return {
    projectType: ctx && ctx.structureClass !== "building" && ctx.structureClass !== "unknown" ? "Infrastructure" : commercial ? "Commercial" : "Residential",
    location: { state: "", city: location ?? "", ownsLand: false },
    buildingType,
    storeys: ctx?.storeys ?? null,
    structuralSystem: ctx?.structuralSystem ?? null,
    foundationType: ctx?.foundationType ?? null,
    timeline: programmeWeeks ? `${programmeWeeks} weeks` : "12 months",
    fundingMethod: "Self",
    involvementLevel: "Hands-on",
    riskOptions: [],
    source: ctx ? "takeoff-structure" : "default",
  };
}

export function programmeWeeks(startDate: string, finishDate: string | null): number | null {
  if (!finishDate) return null;
  return Math.max(1, Math.round(daysBetween(startDate, finishDate) / 7));
}
