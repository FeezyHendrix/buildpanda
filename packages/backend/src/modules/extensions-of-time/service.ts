import type { Knex } from "knex";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import { addCalendarDays, isoDate } from "../../lib/working-days.ts";
import { keyDatesRepository } from "../key-dates/repository.ts";
import { keyDatesService } from "../key-dates/service.ts";
import { eotRepository, type ClaimableDelayRow, type EotRepository } from "./repository.ts";
import type {
  CreateEotClaimInput,
  DecideEotClaimInput,
  EotClaim,
  EotClaimPatch,
  EotClaimRow,
  EotPosition,
  UpdateEotClaimInput,
} from "./types.ts";

function delayIdsOf(row: EotClaimRow): string[] {
  const raw = row.delay_ids;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function toClaim(row: EotClaimRow, delays: ClaimableDelayRow[]): EotClaim {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    reference: `EOT-${String(row.number).padStart(3, "0")}`,
    title: row.title,
    daysClaimed: Number(row.days_claimed ?? 0),
    daysAwarded: row.days_awarded === null ? null : Number(row.days_awarded),
    status: row.status,
    reason: row.reason,
    delayIds: delayIdsOf(row),
    delays: delays.map((d) => ({
      id: d.id,
      activityId: d.activity_id,
      activityName: d.activity_name,
      reasonCode: d.reason_code,
      daysLost: Number(d.days_lost ?? 0),
      culpability: d.culpability,
      eotClaimable: Boolean(d.eot_claimable),
      startedAt: toIso(d.started_at),
    })),
    changeRequestId: row.change_request_id,
    decidedById: row.decided_by_id,
    decidedAt: toIsoOrNull(row.decided_at),
    submittedAt: toIsoOrNull(row.submitted_at),
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Awards `days` of extension of time to a project: the revised completion date
 * moves out by that many CALENDAR days (a contract extends the Time for
 * Completion, it does not re-plan the working week) and every contractual key
 * date — Practical Completion, sectional completion, defects liability end —
 * moves with it. Nothing else on the programme is touched.
 *
 * Pass a signed number: `+14` awards two weeks, `-5` gives five of them back
 * when an award is revised down, so callers that keep a running applied total
 * only ever send the difference.
 *
 * Signature for callers in other modules (W1-C's change requests with a time
 * impact): `applyApprovedEot(projectId, days, trx)` where `trx` is the Knex
 * connection or the open transaction the caller is already inside.
 */
export async function applyApprovedEot(
  projectId: string,
  days: number,
  trx: Knex | Knex.Transaction,
): Promise<{ revisedCompletionDate: string | null; keyDatesMoved: number }> {
  const delta = Math.trunc(days);
  const repo = eotRepository(trx as Knex);
  const project = await repo.projectDates(projectId);
  if (!project) throw new NotFoundError("Project");

  const base = project.revised_completion_date ?? project.completion_date;
  const revised =
    delta !== 0 && base ? isoDate(addCalendarDays(`${base}T00:00:00.000Z`, delta)) : base;
  if (delta !== 0 && revised !== project.revised_completion_date) {
    await repo.setRevisedCompletion(projectId, revised);
  }

  const keyDates = keyDatesService(keyDatesRepository(trx as Knex), async () => "");
  const keyDatesMoved = delta === 0 ? 0 : await keyDates.shiftContractual(projectId, delta);
  return { revisedCompletionDate: revised ?? null, keyDatesMoved };
}

export interface EotDeps {
  /** Applies an award; injected so the service stays free of `db`. */
  applyAward(projectId: string, days: number): Promise<unknown>;
}

export function eotService(repository: EotRepository, deps: EotDeps) {
  async function load(projectId: string, claimId: string): Promise<EotClaimRow> {
    const row = await repository.findById(claimId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Extension of time claim");
    return row;
  }

  async function present(projectId: string, row: EotClaimRow): Promise<EotClaim> {
    const delays = await repository.delaysByIds(projectId, delayIdsOf(row));
    return toClaim(row, delays);
  }

  /**
   * A claim may only cite delays the contractor is not culpable for. Putting a
   * late delivery of your own into an EOT is the single thing that turns a
   * register into a liability, so it is a 400 that names the offending delays.
   */
  async function assertClaimable(projectId: string, delayIds: string[]): Promise<void> {
    if (delayIds.length === 0) return;
    const rows = await repository.delaysByIds(projectId, delayIds);
    const found = new Set(rows.map((r) => r.id));
    const missing = delayIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestError(`Delay not found on this project: ${missing.join(", ")}`);
    }
    const culpable = rows.filter((r) => !r.eot_claimable);
    if (culpable.length > 0) {
      throw new BadRequestError(
        `These delays are not claimable as an extension of time: ${culpable
          .map((r) => `${r.activity_name} (${r.reason_code}, ${r.culpability})`)
          .join("; ")}`,
        { delayIds: culpable.map((r) => r.id) },
      );
    }
  }

  return {
    async list(projectId: string): Promise<EotClaim[]> {
      const rows = await repository.listByProject(projectId);
      if (rows.length === 0) return [];
      const allIds = [...new Set(rows.flatMap(delayIdsOf))];
      const delays = await repository.delaysByIds(projectId, allIds);
      const byId = new Map(delays.map((d) => [d.id, d]));
      return rows.map((row) =>
        toClaim(
          row,
          delayIdsOf(row).flatMap((id) => {
            const delay = byId.get(id);
            return delay ? [delay] : [];
          }),
        ),
      );
    },

    async get(projectId: string, claimId: string): Promise<EotClaim> {
      return present(projectId, await load(projectId, claimId));
    },

    async position(projectId: string): Promise<EotPosition> {
      const { approved, pending, count } = await repository.position(projectId);
      return { daysApproved: approved, daysPending: pending, claimCount: count };
    },

    async create(
      projectId: string,
      input: CreateEotClaimInput,
      actorId: string,
    ): Promise<EotClaim> {
      const delayIds = input.delayIds ?? [];
      await assertClaimable(projectId, delayIds);
      const row = await repository.insert({
        id: generateId("eot"),
        project_id: projectId,
        number: await repository.nextNumber(projectId),
        title: input.title,
        days_claimed: Math.max(0, Math.trunc(input.daysClaimed ?? 0)),
        status: "Draft",
        reason: input.reason ?? null,
        delay_ids: JSON.stringify(delayIds),
        change_request_id: input.changeRequestId ?? null,
        notes: input.notes ?? null,
        created_by_id: actorId,
      });
      return present(projectId, row);
    },

    async update(
      projectId: string,
      claimId: string,
      input: UpdateEotClaimInput,
    ): Promise<EotClaim> {
      const existing = await load(projectId, claimId);
      if (existing.status === "Approved" || existing.status === "Rejected") {
        throw new ConflictError("A decided claim cannot be edited — raise a new claim instead");
      }
      if (input.delayIds !== undefined) await assertClaimable(projectId, input.delayIds);

      const patch: EotClaimPatch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.daysClaimed !== undefined) {
        patch.days_claimed = Math.max(0, Math.trunc(input.daysClaimed));
      }
      if (input.reason !== undefined) patch.reason = input.reason;
      if (input.delayIds !== undefined) patch.delay_ids = JSON.stringify(input.delayIds);
      if (input.changeRequestId !== undefined) patch.change_request_id = input.changeRequestId;
      if (input.notes !== undefined) patch.notes = input.notes;

      const row = await repository.update(claimId, patch);
      if (!row) throw new ConflictError("Claim update failed");
      return present(projectId, row);
    },

    async submit(projectId: string, claimId: string): Promise<EotClaim> {
      const existing = await load(projectId, claimId);
      if (existing.status !== "Draft") {
        throw new ConflictError(`A ${existing.status} claim cannot be submitted`);
      }
      if (Number(existing.days_claimed ?? 0) <= 0) {
        throw new BadRequestError("State the days claimed before submitting");
      }
      await assertClaimable(projectId, delayIdsOf(existing));
      const row = await repository.update(claimId, {
        status: "Submitted",
        submitted_at: new Date().toISOString(),
      });
      if (!row) throw new ConflictError("Claim submit failed");
      return present(projectId, row);
    },

    /**
     * The decision that actually buys time. Approving awards days and moves the
     * revised completion date and every contractual key date by the difference
     * between what has already been applied and the new award — so revising an
     * award from 14 to 9 days pulls five back rather than stacking.
     */
    async decide(
      projectId: string,
      claimId: string,
      input: DecideEotClaimInput,
      actorId: string,
    ): Promise<EotClaim> {
      const existing = await load(projectId, claimId);
      if (existing.status === "Draft") {
        throw new ConflictError("Submit the claim before deciding it");
      }
      const applied = Number(existing.applied_days ?? 0);
      const awarded =
        input.decision === "Rejected" ? 0 : Math.max(0, Math.trunc(input.daysAwarded ?? existing.days_claimed));
      const delta = awarded - applied;

      const patch: EotClaimPatch = {
        status: input.decision,
        days_awarded: input.decision === "Rejected" ? 0 : awarded,
        applied_days: awarded,
        decided_by_id: actorId,
        decided_at: new Date().toISOString(),
      };
      if (input.notes !== undefined) patch.notes = input.notes;

      const row = await repository.update(claimId, patch);
      if (!row) throw new ConflictError("Claim decision failed");
      if (delta !== 0) await deps.applyAward(projectId, delta);
      return present(projectId, row);
    },
  };
}

export type EotService = ReturnType<typeof eotService>;
