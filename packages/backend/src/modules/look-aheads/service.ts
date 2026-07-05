import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso } from "../../lib/dates.ts";
import type { LookAheadPatch, LookAheadsRepository } from "./repository.ts";
import type {
  CreateLookAheadInput,
  LookAhead,
  LookAheadActivityRow,
  LookAheadListFilters,
  LookAheadRow,
  UpdateLookAheadInput,
} from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string, field: string): void {
  if (!DATE_RE.test(value)) throw new BadRequestError(`${field} must be ISO date YYYY-MM-DD`);
}

function toSummary(row: LookAheadActivityRow) {
  return {
    activityId: row.activity_id,
    name: row.name,
    status: row.status,
    plannedStartAt: toIso(row.planned_start_at),
    plannedEndAt: toIso(row.planned_end_at),
    workerCountPlanned: row.worker_count_planned,
  };
}

function toLookAhead(row: LookAheadRow, activities: LookAheadActivityRow[]): LookAhead {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.start_date.slice(0, 10),
    endDate: row.end_date.slice(0, 10),
    totalWorkers: row.total_workers,
    activities: activities.filter((a) => a.look_ahead_id === row.id).map(toSummary),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function timelineOf(row: LookAheadRow, today: string): "past" | "current" | "future" {
  if (row.end_date.slice(0, 10) < today) return "past";
  if (row.start_date.slice(0, 10) > today) return "future";
  return "current";
}

export function lookAheadsService(repository: LookAheadsRepository) {
  return {
    async list(projectId: string, filters: LookAheadListFilters): Promise<LookAhead[]> {
      let rows = await repository.listByProject(projectId, filters.status);

      const today = new Date().toISOString().slice(0, 10);
      if (filters.timeline) {
        rows = rows.filter((r) => timelineOf(r, today) === filters.timeline);
      }

      const activities = await repository.activitiesFor(rows.map((r) => r.id));
      if (filters.activityId) {
        const idsWithActivity = new Set(activities.filter((a) => a.activity_id === filters.activityId).map((a) => a.look_ahead_id));
        rows = rows.filter((r) => idsWithActivity.has(r.id));
      }

      const sortKey = filters.sort ?? "startDate";
      const order = filters.order ?? "desc";
      const sorted = [...rows].sort((a, b) => {
        const av = sortKey === "endDate" ? a.end_date : sortKey === "status" ? a.status : a.start_date;
        const bv = sortKey === "endDate" ? b.end_date : sortKey === "status" ? b.status : b.start_date;
        return order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });

      return sorted.map((row) => toLookAhead(row, activities));
    },

    async get(projectId: string, id: string): Promise<LookAhead> {
      const row = await repository.findById(id);
      if (!row || row.project_id !== projectId) throw new NotFoundError("Look ahead");
      const activities = await repository.activitiesFor([id]);
      return toLookAhead(row, activities);
    },

    async create(projectId: string, input: CreateLookAheadInput, actorId: string | null): Promise<LookAhead> {
      const name = input.name.trim();
      if (!name) throw new BadRequestError("Name is required");
      assertDate(input.startDate, "startDate");
      assertDate(input.endDate, "endDate");
      if (input.endDate < input.startDate) throw new BadRequestError("endDate must not be before startDate");
      if (input.totalWorkers !== undefined && input.totalWorkers !== null && input.totalWorkers < 0) {
        throw new BadRequestError("totalWorkers must be zero or more");
      }

      const row = await repository.insert({
        id: generateId("la"),
        project_id: projectId,
        name,
        description: input.description?.trim() || null,
        status: input.status ?? "Draft",
        start_date: input.startDate,
        end_date: input.endDate,
        total_workers: input.totalWorkers ?? null,
        created_by_id: actorId,
      });

      const activityIds = input.activityIds ?? [];
      if (activityIds.length > 0) await repository.setActivities(row.id, activityIds);

      const activities = await repository.activitiesFor([row.id]);
      return toLookAhead(row, activities);
    },

    async update(projectId: string, id: string, input: UpdateLookAheadInput): Promise<LookAhead> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Look ahead");

      const patch: LookAheadPatch = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new BadRequestError("Name is required");
        patch.name = name;
      }
      if (input.description !== undefined) patch.description = input.description?.trim() || null;
      if (input.status !== undefined) patch.status = input.status;
      if (input.startDate !== undefined) {
        assertDate(input.startDate, "startDate");
        patch.start_date = input.startDate;
      }
      if (input.endDate !== undefined) {
        assertDate(input.endDate, "endDate");
        patch.end_date = input.endDate;
      }
      const nextStart = patch.start_date ?? existing.start_date.slice(0, 10);
      const nextEnd = patch.end_date ?? existing.end_date.slice(0, 10);
      if (nextEnd < nextStart) throw new BadRequestError("endDate must not be before startDate");
      if (input.totalWorkers !== undefined) {
        if (input.totalWorkers !== null && input.totalWorkers < 0) {
          throw new BadRequestError("totalWorkers must be zero or more");
        }
        patch.total_workers = input.totalWorkers;
      }

      const hasFieldUpdates = Object.keys(patch).length > 0;
      const row = hasFieldUpdates ? await repository.update(id, patch) : existing;
      if (!row) throw new NotFoundError("Look ahead");

      if (input.assignActivityIds?.length) await repository.assignActivities(id, input.assignActivityIds);
      if (input.unassignActivityIds?.length) await repository.unassignActivities(id, input.unassignActivityIds);

      const activities = await repository.activitiesFor([id]);
      return toLookAhead(row, activities);
    },

    async remove(projectId: string, id: string): Promise<void> {
      const existing = await repository.findById(id);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Look ahead");
      await repository.delete(id);
    },
  };
}

export type LookAheadsService = ReturnType<typeof lookAheadsService>;
