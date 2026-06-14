import type { Knex } from "knex";
import { generateId } from "../../../lib/ids.ts";
import type { CurrencyCode } from "../../../lib/currencies.ts";
import type { StructuredProgramme, StructuredActivity } from "./structure.ts";
import type { DependencyType } from "./parser.ts";

export interface ApplyProgrammeOptions {
  organizationId: string | null;
  ownerId: string;
  currency: CurrencyCode;
  city: string;
  state: string;
  budgetTotal: number;
  projectName?: string;
}

export interface ApplyProgrammeResult {
  projectId: string;
  phaseCount: number;
  activityCount: number;
  milestoneCount: number;
  totalCost: number;
}

interface StoredDependency {
  activityId: string;
  type: DependencyType;
  lagDays: number;
}

function activityStatus(percent: number): "Planned" | "InProgress" | "Completed" {
  if (percent >= 100) return "Completed";
  if (percent > 0) return "InProgress";
  return "Planned";
}

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function phaseDateSpan(
  activities: StructuredActivity[],
): { start: string | null; end: string | null; range: string } {
  let start: string | null = null;
  let end: string | null = null;
  for (const a of activities) {
    if (a.startAt && (!start || a.startAt < start)) start = a.startAt;
    if (a.endAt && (!end || a.endAt > end)) end = a.endAt;
  }
  const range = start && end ? `${formatShort(start)} – ${formatShort(end)}` : "";
  return { start, end, range };
}

export async function applyProgramme(
  db: Knex,
  programme: StructuredProgramme,
  options: ApplyProgrammeOptions,
): Promise<ApplyProgrammeResult> {
  const projectId = generateId("prj");
  const name = (options.projectName ?? programme.projectName ?? "Imported Project").trim();
  const address = `${options.city}, ${options.state}`;
  const totalCost = programme.activities.reduce((sum, a) => sum + (a.cost || 0), 0);
  const completed = programme.activities.filter((a) => a.percentComplete >= 100).length;
  const progressPercent =
    programme.activities.length > 0 ? Math.round((completed / programme.activities.length) * 100) : 0;

  const phaseIdByKey = new Map<string, string>();
  for (const phase of programme.phases) phaseIdByKey.set(phase.key, generateId("phase"));

  const activityIdByRef = new Map<string, string>();
  for (const activity of programme.activities) {
    activityIdByRef.set(activity.refId, generateId("act"));
  }

  function rewriteDeps(activity: StructuredActivity): StoredDependency[] {
    return activity.predecessors
      .map((p) => {
        const activityId = activityIdByRef.get(p.refId);
        if (!activityId) return null;
        return { activityId, type: p.type, lagDays: p.lagDays };
      })
      .filter((d): d is StoredDependency => d !== null);
  }

  await db.transaction(async (trx) => {
    await trx("projects").insert({
      id: projectId,
      owner_id: options.ownerId,
      organization_id: options.organizationId,
      name,
      address,
      status: "On Track",
      health_score: 0,
      risk: "Low",
      progress_percent: progressPercent,
      budget_total: options.budgetTotal,
      budget_used: 0,
      currency: options.currency,
      pending_approvals: 0,
      folder_tone: "orange",
      budget_min: options.budgetTotal,
      budget_max: options.budgetTotal,
      setup: {
        source: "programme-import",
        importedActivities: programme.activities.length,
        usedAi: programme.usedAi,
      },
    });

    await trx("project_finances").insert({
      project_id: projectId,
      currency: options.currency,
      total_budget: options.budgetTotal,
      funds_deposited: 0,
      funds_released: 0,
      locked_in_escrow: 0,
      remaining_balance: options.budgetTotal,
    });

    if (programme.phases.length > 0) {
      await trx("project_phases").insert(
        programme.phases.map((phase) => {
          const phaseActivities = programme.activities.filter((a) => a.phaseKey === phase.key);
          const span = phaseDateSpan(phaseActivities);
          const allDone =
            phaseActivities.length > 0 && phaseActivities.every((a) => a.percentComplete >= 100);
          const anyStarted = phaseActivities.some((a) => a.percentComplete > 0);
          return {
            id: phaseIdByKey.get(phase.key)!,
            project_id: projectId,
            name: phase.name,
            status: allDone ? "Done" : anyStarted ? "InProgress" : "Pending",
            date_range: span.range,
            sort_order: phase.sort,
          };
        }),
      );
    }

    if (programme.activities.length > 0) {
      await trx("activities").insert(
        programme.activities.map((activity) => ({
          id: activityIdByRef.get(activity.refId)!,
          project_id: projectId,
          phase_id: phaseIdByKey.get(activity.phaseKey) ?? null,
          name: activity.name,
          activity_type: "Construction",
          location: null,
          status: activityStatus(activity.percentComplete),
          planned_start_at: activity.startAt,
          planned_end_at: activity.endAt,
          worker_count_planned: 0,
          notes: null,
          wbs_code: activity.wbsCode,
          outline_level: activity.outlineLevel,
          parent_activity_id: null,
          predecessors: JSON.stringify(rewriteDeps(activity)),
          percent_complete: activity.percentComplete,
          duration_days: activity.durationDays,
          baseline_start_at: activity.startAt,
          baseline_end_at: activity.endAt,
          is_milestone: activity.isMilestone,
          source: "programme-import",
          created_by_id: options.ownerId,
        })),
      );
    }

    const milestones = programme.activities.filter((a) => a.isMilestone);
    const keyDateRows: Array<{
      id: string;
      project_id: string;
      label: string;
      target_date: string | null;
      actual_date: null;
      status: string;
      notes: null;
      sort_order: number;
    }> = [];
    let kdSort = 0;
    const pushKeyDate = (label: string, endIso: string | null, percentComplete: number): void => {
      if (!endIso) return;
      keyDateRows.push({
        id: generateId("kd"),
        project_id: projectId,
        label,
        target_date: toDate(endIso),
        actual_date: null,
        status: percentComplete >= 100 ? "Met" : "Upcoming",
        notes: null,
        sort_order: kdSort++,
      });
    };

    if (milestones.length > 0) {
      for (const m of milestones) pushKeyDate(m.name, m.endAt, m.percentComplete);
    } else {
      if (programme.startAt) pushKeyDate("Project start", programme.startAt, 100);
      for (const phase of programme.phases) {
        const phaseActivities = programme.activities.filter((a) => a.phaseKey === phase.key);
        const span = phaseDateSpan(phaseActivities);
        const done = phaseActivities.length > 0 && phaseActivities.every((a) => a.percentComplete >= 100);
        pushKeyDate(`${phase.name} complete`, span.end, done ? 100 : 0);
      }
      if (programme.endAt) pushKeyDate("Project completion", programme.endAt, progressPercent);
    }

    if (keyDateRows.length > 0) {
      await trx("key_dates").insert(keyDateRows);
    }
  });

  return {
    projectId,
    phaseCount: programme.phases.length,
    activityCount: programme.activities.length,
    milestoneCount: programme.activities.filter((a) => a.isMilestone).length,
    totalCost,
  };
}
