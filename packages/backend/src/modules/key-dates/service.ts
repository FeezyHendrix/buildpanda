import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import {
  addCalendarDays,
  addWorkingDays,
  isoDate,
  toCalendar,
  type WorkingCalendar,
} from "../../lib/working-days.ts";
import type { KeyDatesRepository } from "./repository.ts";
import type {
  KeyDate,
  KeyDateActivityMove,
  KeyDateInput,
  KeyDatePatch,
  KeyDateRow,
} from "./types.ts";

function toKeyDate(r: KeyDateRow): KeyDate {
  return {
    id: r.id,
    projectId: r.project_id,
    label: r.label,
    targetDate: r.target_date,
    actualDate: r.actual_date,
    status: r.status,
    notes: r.notes,
    linkedActivityId: r.linked_activity_id ?? null,
    isContractual: Boolean(r.is_contractual),
    revisedFrom: r.revised_from ?? null,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toPatch(input: KeyDateInput): KeyDatePatch {
  const p: KeyDatePatch = {};
  if (input.label !== undefined) p.label = input.label;
  if (input.targetDate !== undefined) p.target_date = input.targetDate;
  if (input.actualDate !== undefined) p.actual_date = input.actualDate;
  if (input.status !== undefined) p.status = input.status;
  if (input.notes !== undefined) p.notes = input.notes;
  if (input.linkedActivityId !== undefined) p.linked_activity_id = input.linkedActivityId;
  if (input.isContractual !== undefined) p.is_contractual = input.isContractual;
  return p;
}

export function keyDatesService(
  repository: KeyDatesRepository,
  resolveBuildingId: (projectId: string, explicit?: string | null) => Promise<string>,
) {
  async function calendarFor(projectId: string): Promise<WorkingCalendar> {
    const row = await repository.projectCalendar(projectId);
    return toCalendar(row?.working_days, row?.holidays);
  }

  async function assertActivity(projectId: string, activityId: string | null | undefined) {
    if (!activityId) return;
    const activity = await repository.activityBelongsToProject(activityId, projectId);
    if (!activity) throw new BadRequestError("linkedActivityId does not belong to this project");
  }

  return {
    async list(projectId: string, buildingId?: string): Promise<KeyDate[]> {
      const rows = await repository.listByProject(projectId, buildingId);
      return rows.map(toKeyDate);
    },

    async create(projectId: string, input: KeyDateInput): Promise<KeyDate> {
      await assertActivity(projectId, input.linkedActivityId);
      const row = await repository.insert({
        id: generateId("kd"),
        project_id: projectId,
        building_id: await resolveBuildingId(projectId, input.buildingId),
        label: input.label!,
        target_date: input.targetDate ?? null,
        actual_date: input.actualDate ?? null,
        status: input.status ?? "Upcoming",
        notes: input.notes ?? null,
        linked_activity_id: input.linkedActivityId ?? null,
        is_contractual: input.isContractual ?? false,
      });
      return toKeyDate(row);
    },

    async update(projectId: string, keyDateId: string, input: KeyDateInput): Promise<KeyDate> {
      const existing = await repository.findById(keyDateId);
      if (!existing || existing.project_id !== projectId) throw new NotFoundError("Key date");
      await assertActivity(projectId, input.linkedActivityId);
      const row = await repository.update(keyDateId, toPatch(input));
      if (!row) throw new NotFoundError("Key date");
      return toKeyDate(row);
    },

    async remove(projectId: string, keyDateId: string): Promise<void> {
      await repository.remove(keyDateId, projectId);
    },

    /**
     * Carries a programme move on to the dates anchored to it. Only
     * non-contractual dates follow the works — "Culverts complete" slips when
     * culvert 1 slips. Practical Completion does not, because the contract fixed
     * it and only an awarded EOT can change it.
     *
     * `revised_from` is stamped once, with the date originally programmed, so a
     * dispute can always see what was agreed before the revisions started.
     */
    async shiftForActivityMoves(
      projectId: string,
      moves: KeyDateActivityMove[],
    ): Promise<number> {
      const byActivity = new Map(moves.map((m) => [m.id, m.days]));
      const rows = await repository.linkedToActivities([...byActivity.keys()]);
      if (rows.length === 0) return 0;
      const calendar = await calendarFor(projectId);
      let moved = 0;
      for (const row of rows) {
        const days = byActivity.get(row.linked_activity_id ?? "") ?? 0;
        if (days === 0 || !row.target_date) continue;
        const patch: KeyDatePatch = {
          target_date: isoDate(addWorkingDays(`${row.target_date}T00:00:00.000Z`, days, calendar)),
        };
        if (!row.revised_from) patch.revised_from = row.target_date;
        await repository.update(row.id, patch);
        moved += 1;
      }
      return moved;
    },

    /**
     * Moves every contract date by an awarded extension of time. EOT awards are
     * expressed in calendar days — the contract extends the Time for Completion,
     * it does not re-plan the working week.
     */
    async shiftContractual(projectId: string, days: number): Promise<number> {
      const delta = Math.trunc(days);
      if (delta === 0) return 0;
      const rows = await repository.contractualForProject(projectId);
      let moved = 0;
      for (const row of rows) {
        if (!row.target_date) continue;
        const patch: KeyDatePatch = {
          target_date: isoDate(addCalendarDays(`${row.target_date}T00:00:00.000Z`, delta)),
        };
        if (!row.revised_from) patch.revised_from = row.target_date;
        await repository.update(row.id, patch);
        moved += 1;
      }
      return moved;
    },
  };
}

export type KeyDatesService = ReturnType<typeof keyDatesService>;
