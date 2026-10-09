import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import {
  countWorkingDays,
  DEFAULT_CALENDAR,
  type WorkingCalendar,
} from "../../lib/working-days.ts";
import { programmeToMspdiXml } from "./programme-export.ts";
import { buildDelay } from "./delay-mapper.ts";
import type {
  Activity,
  ActivityDelay,
  ActivityDependency,
  ActivityRow,
  ActivityStatus,
  CreateActivityInput,
  DelayReasonRow,
  UpdateActivityInput,
} from "./types.ts";
import type { ActivitiesRepository, ActivityUpdatePatch } from "./repository.ts";
import type { NotificationsService } from "../notifications/service.ts";

interface Actor {
  id: string;
  name: string;
}

export interface ActivitiesDeps {
  notifications?: NotificationsService;
  /** The project's working calendar; durations are working days, not calendar days. */
  calendarFor?(projectId: string): Promise<WorkingCalendar>;
}

/**
 * Status follows the facts on site, it never lags behind them: an activity with
 * an actual finish is Completed (and 100%), one with an actual start is in
 * progress. Cancelled is a decision, so it is never overwritten.
 */
export function deriveStatus(
  current: ActivityStatus,
  actualStart: unknown,
  actualEnd: unknown,
): ActivityStatus {
  if (current === "Cancelled") return current;
  if (actualEnd) return "Completed";
  if (actualStart) return "InProgress";
  return current === "Completed" ? "Planned" : current;
}

function buildActivity(
  row: ActivityRow,
  phaseName: string | null,
  delays: ActivityDelay[],
  calendar: WorkingCalendar,
): Activity {
  const hasOpenDelay = delays.some((d) => d.resolvedAt === null);
  return {
    id: row.id,
    projectId: row.project_id,
    buildingId: row.building_id,
    phaseId: row.phase_id,
    phaseName,
    name: row.name,
    activityType: row.activity_type,
    location: row.location,
    status: row.status,
    isSummary: row.activity_type === "Summary",
    isDelayed: hasOpenDelay,
    plannedStartAt: toIso(row.planned_start_at),
    plannedEndAt: toIso(row.planned_end_at),
    actualStartAt: toIsoOrNull(row.actual_start_at),
    actualEndAt: toIsoOrNull(row.actual_end_at),
    workerCountPlanned: row.worker_count_planned,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name ?? null,
    notes: row.notes,
    wbsCode: row.wbs_code,
    outlineLevel: row.outline_level,
    parentActivityId: row.parent_activity_id,
    predecessors:
      typeof row.predecessors === "string"
        ? (JSON.parse(row.predecessors) as ActivityDependency[])
        : (row.predecessors ?? []),
    percentComplete: Number(row.percent_complete ?? 0),
    durationDays: row.duration_days === null || row.duration_days === undefined ? null : Number(row.duration_days),
    baselineStartAt: toIsoOrNull(row.baseline_start_at),
    baselineEndAt: toIsoOrNull(row.baseline_end_at),
    isMilestone: Boolean(row.is_milestone),
    source: row.source,
    durationWorkingDays: countWorkingDays(row.planned_start_at, row.planned_end_at, calendar),
    delays,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function assertChronology(start: string, end: string, label: string): void {
  if (new Date(start) > new Date(end)) {
    throw new BadRequestError(`${label} end must be on or after start`);
  }
}

export function activitiesService(
  repository: ActivitiesRepository,
  enqueueRecompute: (projectId: string) => Promise<void> = async () => {},
  soleRealBuildingId: (projectId: string) => Promise<string | undefined> = async () => undefined,
  deps: ActivitiesDeps = {},
) {
  const calendarFor = deps.calendarFor ?? (async () => DEFAULT_CALENDAR);

  function notifyAssignee(
    assigneeId: string | null | undefined,
    projectId: string,
    label: string,
    actorId: string,
  ): void {
    if (!deps.notifications || !assigneeId || assigneeId === actorId) return;
    void deps.notifications
      .notify(assigneeId, "activity_assigned", {
        title: "An activity was assigned to you",
        body: label,
        projectId,
      })
      .catch(() => undefined);
  }

  async function loadPhaseMap(projectId: string): Promise<Map<string, string>> {
    const phases = await repository.phaseNamesForProject(projectId);
    return new Map(phases.map((p) => [p.id, p.name]));
  }

  async function resolveCreateBuildingId(projectId: string, input: CreateActivityInput): Promise<string> {
    let buildingId = input.buildingId ?? null;
    if (input.phaseId) {
      const phase = await repository.phaseById(input.phaseId);
      if (!phase || phase.project_id !== projectId) {
        throw new BadRequestError("phaseId does not belong to this project");
      }
      if (buildingId && buildingId !== phase.building_id) {
        throw new BadRequestError("buildingId must match the selected phase");
      }
      buildingId = phase.building_id;
    }
    if (input.parentActivityId) {
      const parent = await repository.findById(input.parentActivityId);
      if (!parent || parent.project_id !== projectId) {
        throw new BadRequestError("parentActivityId does not belong to this project");
      }
      if (buildingId && buildingId !== parent.building_id) {
        throw new BadRequestError("buildingId must match the parent activity");
      }
      buildingId = parent.building_id;
    }
    if (buildingId) return buildingId;
    const defaultBuildingId = await soleRealBuildingId(projectId);
    if (!defaultBuildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    return defaultBuildingId;
  }

  async function loadReasonMap(codes: string[]): Promise<Map<string, DelayReasonRow>> {
    if (codes.length === 0) return new Map();
    const rows = await repository.reasonsByCodes(codes);
    return new Map(rows.map((r) => [r.code, r]));
  }

  async function loadProjectActivity(
    projectId: string,
    activityId: string,
  ): Promise<ActivityRow> {
    const row = await repository.findById(activityId);
    if (!row || row.project_id !== projectId) {
      throw new NotFoundError("Activity");
    }
    return row;
  }

  async function buildOne(row: ActivityRow): Promise<Activity> {
    const [phases, delayRows, calendar] = await Promise.all([
      loadPhaseMap(row.project_id),
      repository.delaysForActivity(row.id),
      calendarFor(row.project_id),
    ]);
    const reasons = await loadReasonMap(delayRows.map((d) => d.reason_code));
    const delays = delayRows.map((d) => buildDelay(d, reasons.get(d.reason_code)));
    return buildActivity(
      row,
      row.phase_id ? phases.get(row.phase_id) ?? null : null,
      delays,
      calendar,
    );
  }

  return {
    async exportProgrammeXml(
      projectId: string,
      projectName: string,
      buildingId?: string,
    ): Promise<string> {
      return programmeToMspdiXml(projectName, await this.listByProject(projectId, buildingId));
    },

    async listByProject(projectId: string, buildingId?: string): Promise<Activity[]> {
      const rows = await repository.listByProject(projectId, buildingId);
      if (rows.length === 0) return [];
      const [phases, delayRows, calendar] = await Promise.all([
        loadPhaseMap(projectId),
        repository.delaysForActivities(rows.map((r) => r.id)),
        calendarFor(projectId),
      ]);
      const reasons = await loadReasonMap(delayRows.map((d) => d.reason_code));

      const delaysByActivity = new Map<string, ActivityDelay[]>();
      for (const row of delayRows) {
        const list = delaysByActivity.get(row.activity_id) ?? [];
        list.push(buildDelay(row, reasons.get(row.reason_code)));
        delaysByActivity.set(row.activity_id, list);
      }

      return rows.map((row) =>
        buildActivity(
          row,
          row.phase_id ? phases.get(row.phase_id) ?? null : null,
          delaysByActivity.get(row.id) ?? [],
          calendar,
        ),
      );
    },

    async getById(projectId: string, activityId: string): Promise<Activity> {
      const row = await loadProjectActivity(projectId, activityId);
      return buildOne(row);
    },

    async create(
      projectId: string,
      input: CreateActivityInput,
      actor: Actor,
    ): Promise<Activity> {
      assertChronology(input.plannedStartAt, input.plannedEndAt, "Planned");

      const buildingId = await resolveCreateBuildingId(projectId, input);

      const row = await repository.create({
        id: generateId("act"),
        project_id: projectId,
        building_id: buildingId,
        phase_id: input.phaseId ?? null,
        name: input.name,
        activity_type: input.activityType,
        // Location is optional on the form; an empty box is "no location", not
        // an empty string the schema then rejects.
        location: input.location?.trim() ? input.location.trim() : null,
        status: input.status ?? "Planned",
        planned_start_at: input.plannedStartAt,
        planned_end_at: input.plannedEndAt,
        worker_count_planned: input.workerCountPlanned ?? 0,
        assignee_id: input.assigneeId ?? null,
        notes: input.notes ?? null,
        wbs_code: input.wbsCode ?? null,
        outline_level: input.outlineLevel ?? null,
        parent_activity_id: input.parentActivityId ?? null,
        predecessors: JSON.stringify(input.predecessors ?? []),
        percent_complete: input.percentComplete ?? 0,
        duration_days: input.durationDays ?? null,
        baseline_start_at: input.baselineStartAt ?? null,
        baseline_end_at: input.baselineEndAt ?? null,
        is_milestone: input.isMilestone ?? false,
        source: input.source ?? "manual",
        created_by_id: actor.id,
      });
      await enqueueRecompute(projectId);
      notifyAssignee(row.assignee_id, projectId, row.name, actor.id);
      return buildOne(await loadProjectActivity(projectId, row.id));
    },

    async update(
      projectId: string,
      activityId: string,
      input: UpdateActivityInput,
      actorId?: string,
    ): Promise<Activity> {
      const existing = await loadProjectActivity(projectId, activityId);

      if (input.plannedStartAt && input.plannedEndAt) {
        assertChronology(input.plannedStartAt, input.plannedEndAt, "Planned");
      }
      if (input.actualStartAt && input.actualEndAt) {
        assertChronology(input.actualStartAt, input.actualEndAt, "Actual");
      }
      if (input.phaseId) {
        const phases = await loadPhaseMap(projectId);
        if (!phases.has(input.phaseId)) {
          throw new BadRequestError("phaseId does not belong to this project");
        }
      }

      const patch: ActivityUpdatePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.activityType !== undefined) patch.activity_type = input.activityType;
      if (input.phaseId !== undefined) patch.phase_id = input.phaseId;
      if (input.location !== undefined) {
        patch.location = input.location?.trim() ? input.location.trim() : null;
      }
      if (input.status !== undefined) patch.status = input.status;
      if (input.plannedStartAt !== undefined) patch.planned_start_at = input.plannedStartAt;
      if (input.plannedEndAt !== undefined) patch.planned_end_at = input.plannedEndAt;
      if (input.actualStartAt !== undefined) patch.actual_start_at = input.actualStartAt;
      if (input.actualEndAt !== undefined) patch.actual_end_at = input.actualEndAt;
      if (input.workerCountPlanned !== undefined)
        patch.worker_count_planned = input.workerCountPlanned;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
      if (input.predecessors !== undefined) patch.predecessors = JSON.stringify(input.predecessors);
      if (input.percentComplete !== undefined) patch.percent_complete = input.percentComplete;
      if (input.isMilestone !== undefined) patch.is_milestone = input.isMilestone;

      // Actual dates drive status, not the other way round: an activity with an
      // actual finish is complete, whatever the dropdown still says.
      const actualStart =
        input.actualStartAt !== undefined ? input.actualStartAt : existing.actual_start_at;
      const actualEnd = input.actualEndAt !== undefined ? input.actualEndAt : existing.actual_end_at;
      if (input.actualStartAt !== undefined || input.actualEndAt !== undefined) {
        const derived = deriveStatus(input.status ?? existing.status, actualStart, actualEnd);
        if (derived !== existing.status || input.status !== undefined) patch.status = derived;
        if (derived === "Completed" && input.percentComplete === undefined) {
          patch.percent_complete = 100;
        }
      } else if (input.status === "Completed" && input.percentComplete === undefined) {
        patch.percent_complete = 100;
      }

      const updated = await repository.update(activityId, patch);
      if (!updated) throw new ConflictError("Activity update failed");

      if (input.assigneeId !== undefined && input.assigneeId !== existing.assignee_id) {
        notifyAssignee(updated.assignee_id, projectId, updated.name, actorId ?? "");
      }

      const affectsSchedule =
        input.plannedStartAt !== undefined ||
        input.plannedEndAt !== undefined ||
        input.phaseId !== undefined ||
        input.status !== undefined ||
        input.percentComplete !== undefined;
      if (affectsSchedule) {
        await enqueueRecompute(projectId);
      }

      return buildOne(await loadProjectActivity(projectId, updated.id));
    },

    async remove(projectId: string, activityId: string): Promise<void> {
      await loadProjectActivity(projectId, activityId);
      await repository.deleteActivity(activityId);
      await enqueueRecompute(projectId);
    },

    /** The programme's audit trail for one activity — every shift, with days and actor. */
    async listEvents(projectId: string, activityId: string) {
      await loadProjectActivity(projectId, activityId);
      const rows = await repository.eventsForActivity(activityId);
      return rows.map((row) => ({
        id: row.id,
        activityId: row.activity_id,
        kind: row.kind,
        summary: row.summary,
        daysDelta: Number(row.days_delta ?? 0),
        delayId: row.delay_id,
        actorId: row.actor_id,
        createdAt: toIso(row.created_at),
      }));
    },

    listReasons() {
      return repository.listReasons();
    },
  };
}

export type ActivitiesService = ReturnType<typeof activitiesService>;
