import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import type {
  Activity,
  ActivityDelay,
  ActivityDelayRow,
  ActivityDependency,
  ActivityRow,
  CreateActivityInput,
  DelayReasonRow,
  RaiseDelayInput,
  ResolveDelayInput,
  UpdateActivityInput,
} from "./types.ts";
import type { ActivitiesRepository } from "./repository.ts";
import type { NotificationsService } from "../notifications/service.ts";

interface Actor {
  id: string;
  name: string;
}

export interface ActivitiesDeps {
  notifications?: NotificationsService;
}

function buildDelay(
  row: ActivityDelayRow,
  reason: DelayReasonRow | undefined,
): ActivityDelay {
  return {
    id: row.id,
    activityId: row.activity_id,
    reasonCode: row.reason_code,
    reasonName: reason?.name ?? row.reason_code,
    reasonCategory: reason?.category ?? "Other",
    description: row.description,
    descriptionHtml: row.description_html,
    startedAt: toIso(row.started_at),
    resolvedAt: toIsoOrNull(row.resolved_at),
    costImpact: Number(row.cost_impact),
    currency: row.currency,
    preventionNotes: row.prevention_notes,
    recordedBy: row.recorded_by_id ? { id: row.recorded_by_id, name: null } : null,
    createdAt: toIso(row.created_at),
  };
}

function buildActivity(
  row: ActivityRow,
  phaseName: string | null,
  delays: ActivityDelay[],
): Activity {
  const hasOpenDelay = delays.some((d) => d.resolvedAt === null);
  return {
    id: row.id,
    projectId: row.project_id,
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
    const [phases, delayRows] = await Promise.all([
      loadPhaseMap(row.project_id),
      repository.delaysForActivity(row.id),
    ]);
    const reasons = await loadReasonMap(delayRows.map((d) => d.reason_code));
    const delays = delayRows.map((d) => buildDelay(d, reasons.get(d.reason_code)));
    return buildActivity(row, row.phase_id ? phases.get(row.phase_id) ?? null : null, delays);
  }

  return {
    async listByProject(projectId: string): Promise<Activity[]> {
      const rows = await repository.listByProject(projectId);
      if (rows.length === 0) return [];
      const [phases, delayRows] = await Promise.all([
        loadPhaseMap(projectId),
        repository.delaysForActivities(rows.map((r) => r.id)),
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
        location: input.location ?? null,
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

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.activityType !== undefined) patch.activity_type = input.activityType;
      if (input.phaseId !== undefined) patch.phase_id = input.phaseId;
      if (input.location !== undefined) patch.location = input.location;
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

    async raiseDelay(
      projectId: string,
      activityId: string,
      input: RaiseDelayInput,
      actor: Actor,
    ): Promise<ActivityDelay> {
      await loadProjectActivity(projectId, activityId);

      const reason = await repository.findReasonByCode(input.reasonCode);
      if (!reason) throw new BadRequestError("Unknown delay reason code");

      const row = await repository.createDelay({
        id: generateId("delay"),
        activity_id: activityId,
        reason_code: input.reasonCode,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        started_at: input.startedAt,
        cost_impact: input.costImpact ?? 0,
        currency: input.currency ?? "NGN",
        prevention_notes: input.preventionNotes ?? null,
        recorded_by_id: actor.id,
      });
      return buildDelay(row, reason);
    },

    async resolveDelay(
      projectId: string,
      activityId: string,
      delayId: string,
      input: ResolveDelayInput,
    ): Promise<ActivityDelay> {
      await loadProjectActivity(projectId, activityId);

      const existing = await repository.findDelayById(delayId);
      if (!existing || existing.activity_id !== activityId) {
        throw new NotFoundError("Delay");
      }
      if (existing.resolved_at) {
        throw new ConflictError("Delay is already resolved");
      }
      if (new Date(input.resolvedAt) < new Date(existing.started_at)) {
        throw new BadRequestError("resolvedAt cannot be before startedAt");
      }

      const patch: Parameters<typeof repository.resolveDelay>[1] = {
        resolved_at: input.resolvedAt,
      };
      if (input.preventionNotes !== undefined) {
        patch.prevention_notes = input.preventionNotes;
      }

      const row = await repository.resolveDelay(delayId, patch);
      if (!row) throw new ConflictError("Delay resolve failed");
      const reason = await repository.findReasonByCode(row.reason_code);
      return buildDelay(row, reason);
    },

    listReasons() {
      return repository.listReasons();
    },
  };
}

export type ActivitiesService = ReturnType<typeof activitiesService>;
