import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  Activity,
  ActivityDelay,
  ActivityDelayRow,
  ActivityRow,
  CreateActivityInput,
  DelayReasonRow,
  RaiseDelayInput,
  ResolveDelayInput,
  UpdateActivityInput,
} from "./types.ts";
import type { ActivitiesRepository } from "./repository.ts";

interface Actor {
  id: string;
  name: string;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function toIsoOrNull(value: Date | string | null): string | null {
  return value ? toIso(value) : null;
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
    isDelayed: hasOpenDelay,
    plannedStartAt: toIso(row.planned_start_at),
    plannedEndAt: toIso(row.planned_end_at),
    actualStartAt: toIsoOrNull(row.actual_start_at),
    actualEndAt: toIsoOrNull(row.actual_end_at),
    workerCountPlanned: row.worker_count_planned,
    notes: row.notes,
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

export function activitiesService(repository: ActivitiesRepository) {
  async function loadPhaseMap(projectId: string): Promise<Map<string, string>> {
    const phases = await repository.phaseNamesForProject(projectId);
    return new Map(phases.map((p) => [p.id, p.name]));
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

      if (input.phaseId) {
        const phases = await loadPhaseMap(projectId);
        if (!phases.has(input.phaseId)) {
          throw new BadRequestError("phaseId does not belong to this project");
        }
      }

      const row = await repository.create({
        id: generateId("act"),
        project_id: projectId,
        phase_id: input.phaseId ?? null,
        name: input.name,
        activity_type: input.activityType,
        location: input.location ?? null,
        status: "Planned",
        planned_start_at: input.plannedStartAt,
        planned_end_at: input.plannedEndAt,
        worker_count_planned: input.workerCountPlanned ?? 0,
        notes: input.notes ?? null,
        created_by_id: actor.id,
      });
      return buildOne(row);
    },

    async update(
      projectId: string,
      activityId: string,
      input: UpdateActivityInput,
    ): Promise<Activity> {
      await loadProjectActivity(projectId, activityId);

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

      const updated = await repository.update(activityId, patch);
      if (!updated) throw new ConflictError("Activity update failed");
      return buildOne(updated);
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
