import type { Knex } from "knex";
import { generateId } from "../../../lib/ids.ts";
import { BadRequestError } from "../../../lib/errors.ts";
import type { CurrencyCode } from "../../../lib/currencies.ts";
import type { StructuredProgramme, StructuredActivity } from "./structure.ts";
import type { DependencyType } from "./parser.ts";
import { buildingsRepository } from "../../buildings/repository.ts";

export interface ApplyProgrammeOptions {
  organizationId: string | null;
  ownerId: string;
  currency: CurrencyCode;
  city: string;
  state: string;
  budgetTotal: number;
  projectName?: string;
  existingProjectId?: string;
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

function phaseCostByMonth(
  activities: StructuredActivity[],
): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const a of activities) {
    if (a.isSummary) continue;
    if (!a.cost || a.cost <= 0 || !a.startAt || !a.endAt) continue;
    const start = new Date(a.startAt);
    const end = new Date(a.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      continue;
    }
    const totalDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const perDay = a.cost / totalDays;
    const cursor = new Date(start);
    while (cursor <= end) {
      const period = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      byMonth.set(period, (byMonth.get(period) ?? 0) + perDay);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return byMonth;
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
  const projectId = options.existingProjectId ?? generateId("prj");
  const isNewProject = !options.existingProjectId;
  const buildingId = isNewProject
    ? generateId("bld")
    : await buildingsRepository(db).soleRealBuildingId(projectId);
  if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
  const name = (options.projectName ?? programme.projectName ?? "Imported Project").trim();
  const address = `${options.city}, ${options.state}`;
  const workActivities = programme.activities.filter((a) => !a.isSummary);
  const progressActivities = workActivities.length > 0 ? workActivities : programme.activities;
  const totalCost = workActivities.reduce((sum, a) => sum + (a.cost || 0), 0);
  const completed = progressActivities.filter((a) => a.percentComplete >= 100).length;
  const progressPercent =
    progressActivities.length > 0 ? Math.round((completed / progressActivities.length) * 100) : 0;

  const phaseIdByKey = new Map<string, string>();
  for (const phase of programme.phases) phaseIdByKey.set(phase.key, generateId("phase"));

  const activityIdByRef = new Map<string, string>();
  for (const activity of programme.activities) {
    activityIdByRef.set(activity.refId, generateId("act"));
  }

  function parentActivityId(activity: StructuredActivity): string | null {
    return activity.parentRefId ? (activityIdByRef.get(activity.parentRefId) ?? null) : null;
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
    if (isNewProject) {
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

      await trx("buildings").insert([
        {
          id: buildingId,
          project_id: projectId,
          name,
          kind: "real",
          status: "active",
          sort_order: 0,
          progress_percent: progressPercent,
        },
        {
          id: `bld_shared_${projectId}`,
          project_id: projectId,
          name: "Shared",
          kind: "shared",
          status: "active",
          sort_order: -1,
          progress_percent: 0,
        },
      ]);

      await trx("project_finances").insert({
        project_id: projectId,
        currency: options.currency,
        total_budget: options.budgetTotal,
        funds_deposited: 0,
        funds_released: 0,
        locked_in_escrow: 0,
        remaining_balance: options.budgetTotal,
      });
    } else {
      await trx("activities").where({ project_id: projectId, source: "programme-import" }).del();
      await trx("key_dates").where({ project_id: projectId }).del();
    }

    if (programme.phases.length > 0) {
      const reusedKeys = new Set<string>();
      if (!isNewProject) {
        const existingPhases = await trx("project_phases")
          .where({ project_id: projectId })
          .select<{ id: string; name: string }[]>("id", "name");
        const existingByName = new Map(existingPhases.map((p) => [p.name, p.id]));
        for (const phase of programme.phases) {
          const matched = existingByName.get(phase.name);
          if (matched) {
            phaseIdByKey.set(phase.key, matched);
            reusedKeys.add(phase.key);
          }
        }
      }

      const newPhases = programme.phases.filter((phase) => !reusedKeys.has(phase.key));
      if (newPhases.length > 0) {
        await trx("project_phases").insert(
          newPhases.map((phase) => {
            const phaseActivities = programme.activities.filter((a) => a.phaseKey === phase.key);
            const span = phaseDateSpan(phaseActivities);
            const allDone =
              phaseActivities.length > 0 && phaseActivities.every((a) => a.percentComplete >= 100);
            const anyStarted = phaseActivities.some((a) => a.percentComplete > 0);
            return {
              id: phaseIdByKey.get(phase.key)!,
              project_id: projectId,
              building_id: buildingId,
              name: phase.name,
              status: allDone ? "Done" : anyStarted ? "InProgress" : "Pending",
              date_range: span.range,
              sort_order: phase.sort,
            };
          }),
        );
      }
    }

    if (programme.activities.length > 0) {
      await trx("activities").insert(
        programme.activities.map((activity) => ({
          id: activityIdByRef.get(activity.refId)!,
          project_id: projectId,
          building_id: buildingId,
          phase_id: phaseIdByKey.get(activity.phaseKey) ?? null,
          name: activity.name,
          activity_type: activity.isSummary ? "Summary" : "Construction",
          location: null,
          status: activityStatus(activity.percentComplete),
          planned_start_at: activity.startAt,
          planned_end_at: activity.endAt,
          worker_count_planned: 0,
          notes: null,
          wbs_code: activity.wbsCode,
          outline_level: activity.outlineLevel,
          parent_activity_id: parentActivityId(activity),
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
      building_id: string;
      label: string;
      target_date: string | null;
      actual_date: null;
      status: string;
      notes: null;
      sort_order: number;
    }> = [];
    let kdSort = 0;
    const seen = new Set<string>();
    const pushKeyDate = (label: string, endIso: string | null, percentComplete: number): void => {
      if (!endIso) return;
      const target = toDate(endIso);
      const dedupeKey = `${label}|${target}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      keyDateRows.push({
        id: generateId("kd"),
        project_id: projectId,
        building_id: buildingId,
        label,
        target_date: target,
        actual_date: null,
        status: percentComplete >= 100 ? "Met" : "Upcoming",
        notes: null,
        sort_order: kdSort++,
      });
    };

    if (programme.startAt) pushKeyDate("Project start", programme.startAt, 100);
    for (const m of milestones) pushKeyDate(m.name, m.endAt, m.percentComplete);
    for (const phase of programme.phases) {
      const phaseActivities = programme.activities.filter((a) => a.phaseKey === phase.key);
      const span = phaseDateSpan(phaseActivities);
      const done = phaseActivities.length > 0 && phaseActivities.every((a) => a.percentComplete >= 100);
      pushKeyDate(`${phase.name} complete`, span.end, done ? 100 : 0);
    }
    if (programme.endAt) pushKeyDate("Project completion", programme.endAt, progressPercent);

    if (keyDateRows.length > 0) {
      await trx("key_dates").insert(keyDateRows);
    }

    const costByMonth = phaseCostByMonth(programme.activities);
    if (costByMonth.size > 0) {
      const versionRow = await trx("programme_cost_phasing")
        .where({ project_id: projectId })
        .max<{ max: number | null }>("programme_version as max")
        .first();
      const nextVersion = (versionRow?.max ?? 0) + 1;
      const phasingRows = [...costByMonth.entries()].map(([period, cost]) => ({
        project_id: projectId,
        period,
        planned_cost: String(Math.round((cost + Number.EPSILON) * 100) / 100),
        programme_version: nextVersion,
      }));
      await trx("programme_cost_phasing").insert(phasingRows);
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
