import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { isoDate, type WorkingCalendar } from "../../lib/working-days.ts";
import { cascadeShift } from "./cascade.ts";
import { buildDelay } from "./delay-mapper.ts";
import type { ActivitiesRepository, DelayResolvePatch } from "./repository.ts";
import type {
  ActivityDelay,
  ActivityDelayRow,
  Culpability,
  DelayReasonRow,
  RaiseDelayInput,
  ResolveDelayInput,
  ShiftedActivity,
} from "./types.ts";

export interface DelaysDeps {
  calendarFor(projectId: string): Promise<WorkingCalendar>;
  onActivitiesShifted?(projectId: string, moves: ShiftedActivity[]): Promise<void>;
  now?(): Date;
}

function defaultsFor(reason: DelayReasonRow): { culpability: Culpability; eotClaimable: boolean } {
  return {
    culpability: reason.default_culpability ?? "neutral",
    eotClaimable: reason.default_eot_claimable ?? false,
  };
}

/**
 * Delays as schedule events. Raising one measures lost time and pushes the
 * programme; amending one re-measures it and pushes the difference. The delay
 * itself carries `applied_shift_days` — the working days it has already moved
 * the chain by — so every amendment is a delta and the maths never stacks.
 */
export function delaysService(repository: ActivitiesRepository, deps: DelaysDeps) {
  const now = deps.now ?? (() => new Date());

  async function activityOf(projectId: string, activityId: string) {
    const row = await repository.findById(activityId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Activity");
    return row;
  }

  async function present(row: ActivityDelayRow): Promise<ActivityDelay> {
    const reason = await repository.findReasonByCode(row.reason_code);
    return buildDelay(row, reason);
  }

  async function applyDelta(
    projectId: string,
    activityId: string,
    delta: number,
    delayId: string,
    actorId: string | null,
    summary: string,
  ): Promise<void> {
    if (delta === 0) return;
    await cascadeShift(
      {
        repository,
        calendarFor: deps.calendarFor,
        ...(deps.onActivitiesShifted ? { onActivitiesShifted: deps.onActivitiesShifted } : {}),
      },
      projectId,
      activityId,
      delta,
      { actorId, delayId, kind: "delay_shift", summary },
    );
  }

  return {
    async listForActivity(projectId: string, activityId: string): Promise<ActivityDelay[]> {
      await activityOf(projectId, activityId);
      const rows = await repository.delaysForActivity(activityId);
      const reasons = await repository.reasonsByCodes(rows.map((r) => r.reason_code));
      const byCode = new Map(reasons.map((r) => [r.code, r]));
      return rows.map((row) => buildDelay(row, byCode.get(row.reason_code)));
    },

    async raise(
      projectId: string,
      activityId: string,
      input: RaiseDelayInput,
      actor: { id: string; name: string },
    ): Promise<ActivityDelay> {
      const activity = await activityOf(projectId, activityId);

      const reason = await repository.findReasonByCode(input.reasonCode);
      if (!reason) throw new BadRequestError("Unknown delay reason code");

      // A delay is a record of something that happened. A future stoppage is a
      // risk, and belongs on the risk register, not on the programme.
      if (isoDate(input.startedAt) > isoDate(now())) {
        throw new BadRequestError(
          "A delay is a record of something that happened — it cannot start in the future",
        );
      }
      if (input.endedAt && new Date(input.endedAt) < new Date(input.startedAt)) {
        throw new BadRequestError("endedAt cannot be before startedAt");
      }

      const fallback = defaultsFor(reason);
      const daysLost = Math.max(0, Math.trunc(input.daysLost ?? 0));
      const culpability = input.culpability ?? fallback.culpability;
      // Only the client or a neutral event can buy time back; a contractor's own
      // breakdown never becomes an EOT, whatever the form says.
      const eotClaimable =
        culpability === "contractor" ? false : (input.eotClaimable ?? fallback.eotClaimable);

      const row = await repository.createDelay({
        id: generateId("delay"),
        activity_id: activityId,
        reason_code: input.reasonCode,
        description: input.description ?? null,
        description_html: input.descriptionHtml ?? null,
        started_at: input.startedAt,
        ended_at: input.endedAt ?? null,
        days_lost: daysLost,
        culpability,
        eot_claimable: eotClaimable,
        linked_rfi_id: input.linkedRfiId ?? null,
        linked_change_request_id: input.linkedChangeRequestId ?? null,
        linked_material_order_id: input.linkedMaterialOrderId ?? null,
        applied_shift_days: 0,
        cost_impact: input.costImpact ?? 0,
        currency: input.currency ?? "NGN",
        prevention_notes: input.preventionNotes ?? null,
        recorded_by_id: actor.id,
      });

      if (daysLost > 0) {
        await applyDelta(
          projectId,
          activityId,
          daysLost,
          row.id,
          actor.id,
          `${reason.name} delay on ${activity.name}: ${daysLost} working day(s) lost`,
        );
        const applied = await repository.resolveDelay(row.id, { applied_shift_days: daysLost });
        if (applied) return present(applied);
      }
      return buildDelay(row, reason);
    },

    /**
     * Amends a delay: ends it, re-measures the days lost, re-attributes it or
     * closes it out. Any change to `daysLost` re-runs the cascade with the
     * difference, so a delay corrected from 6 days to 4 pulls the chain back 2.
     */
    async amend(
      projectId: string,
      activityId: string,
      delayId: string,
      input: ResolveDelayInput,
      actor: { id: string; name: string },
    ): Promise<ActivityDelay> {
      const activity = await activityOf(projectId, activityId);
      const existing = await repository.findDelayById(delayId);
      if (!existing || existing.activity_id !== activityId) throw new NotFoundError("Delay");
      if (input.resolvedAt && existing.resolved_at) {
        throw new ConflictError("Delay is already resolved");
      }
      const endedAt = input.endedAt ?? existing.ended_at;
      if (endedAt && new Date(endedAt) < new Date(existing.started_at)) {
        throw new BadRequestError("endedAt cannot be before startedAt");
      }
      if (input.resolvedAt && new Date(input.resolvedAt) < new Date(existing.started_at)) {
        throw new BadRequestError("resolvedAt cannot be before startedAt");
      }

      const patch: DelayResolvePatch = {};
      if (input.endedAt !== undefined) patch.ended_at = input.endedAt;
      if (input.preventionNotes !== undefined) patch.prevention_notes = input.preventionNotes;
      if (input.linkedRfiId !== undefined) patch.linked_rfi_id = input.linkedRfiId;
      if (input.linkedChangeRequestId !== undefined) {
        patch.linked_change_request_id = input.linkedChangeRequestId;
      }
      if (input.linkedMaterialOrderId !== undefined) {
        patch.linked_material_order_id = input.linkedMaterialOrderId;
      }
      const culpability = input.culpability ?? existing.culpability;
      if (input.culpability !== undefined) patch.culpability = input.culpability;
      if (input.eotClaimable !== undefined || input.culpability !== undefined) {
        patch.eot_claimable =
          culpability === "contractor"
            ? false
            : (input.eotClaimable ?? Boolean(existing.eot_claimable));
      }

      // A delay that has ended is closed out — that is what "resolve" means to a
      // PM, and it is why every delay in the field run stayed open forever.
      const resolvedAt =
        input.resolvedAt ?? (input.endedAt && !existing.resolved_at ? input.endedAt : undefined);
      if (resolvedAt) {
        patch.resolved_at = resolvedAt;
        patch.resolved_by_id = actor.id;
      }

      const desired =
        input.daysLost === undefined
          ? Number(existing.days_lost ?? 0)
          : Math.max(0, Math.trunc(input.daysLost));
      const delta = desired - Number(existing.applied_shift_days ?? 0);
      if (input.daysLost !== undefined) patch.days_lost = desired;
      if (delta !== 0) patch.applied_shift_days = desired;

      const updated = await repository.resolveDelay(delayId, patch);
      if (!updated) throw new ConflictError("Delay update failed");

      if (delta !== 0) {
        await applyDelta(
          projectId,
          activityId,
          delta,
          delayId,
          actor.id,
          `Delay on ${activity.name} re-measured to ${desired} working day(s)`,
        );
      }
      return present(updated);
    },
  };
}

export type DelaysService = ReturnType<typeof delaysService>;
