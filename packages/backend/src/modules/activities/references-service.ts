import { NotFoundError } from "../../lib/errors.ts";
import type { ActivityReferencesRepository } from "./references-repository.ts";
import type {
  ActivityDelayReference,
  ActivityDelayReferenceRow,
  ActivityLookAheadReference,
  ActivityLookAheadReferenceRow,
  ActivityReferences,
} from "./references-types.ts";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toLookAhead(row: ActivityLookAheadReferenceRow): ActivityLookAheadReference {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startDate: toIso(row.start_date).slice(0, 10),
    endDate: toIso(row.end_date).slice(0, 10),
  };
}

function toDelay(row: ActivityDelayReferenceRow): ActivityDelayReference {
  return {
    id: row.id,
    reasonCode: row.reason_code,
    startedAt: toIso(row.started_at),
    resolved: row.resolved_at !== null,
  };
}

export function activityReferencesService(repository: ActivityReferencesRepository) {
  return {
    async get(projectId: string, activityId: string): Promise<ActivityReferences> {
      const activity = await repository.activityProjectId(activityId);
      if (!activity || activity.project_id !== projectId) throw new NotFoundError("Activity");

      const [lookAheadRows, delayRows] = await Promise.all([
        repository.lookAheadsForActivity(activityId),
        repository.delaysForActivity(activityId),
      ]);

      const lookAheads = lookAheadRows.map(toLookAhead);
      const delays = delayRows.map(toDelay);
      return {
        activityId,
        lookAheads,
        blockedByApprovedLookAhead: lookAheads.some((l) => l.status === "Approved"),
        delays,
        openDelayCount: delays.filter((d) => !d.resolved).length,
      };
    },
  };
}

export type ActivityReferencesService = ReturnType<typeof activityReferencesService>;
