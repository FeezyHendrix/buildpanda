import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import type { ChangeRequestsRepository, ChangeRequestUpdatePatch } from "./repository.ts";
import {
  appendRevision,
  assertNotSelfDecision,
  assertReason,
  assertTransition,
  resultingStatus,
} from "./transitions.ts";
import type { ChangeAction, ChangeActionInput, ChangeRequestRow } from "./types.ts";

export interface ChangeActionActor {
  id: string;
  name: string;
  /** True when the caller holds change-requests:manage — the approval grant. */
  holdsApproval: boolean;
}

/** What executing an approved change does to the programme and the contract. */
export interface ChangeExecutionDeps {
  /** Refuses execution until the change-order contract is signed. */
  assertExecutable: (row: ChangeRequestRow) => Promise<void>;
  /** Moves the stage's end date by the agreed days. From the stages module. */
  shiftStageEnd?: (projectId: string, stageId: string, days: number) => Promise<void>;
  /**
   * Awards the days as an extension of time. Wired to the extensions-of-time
   * module's `applyApprovedEot`, which owns the revised completion date and the
   * contractual key dates that move with it.
   */
  applyApprovedEot?: (projectId: string, days: number) => Promise<void>;
  /** Generates the change-order contract and records the variation on approval. */
  onApproved?: (row: ChangeRequestRow, actor: ChangeActionActor) => Promise<void>;
  /** Tells the project the change moved. */
  onDecided?: (row: ChangeRequestRow, action: ChangeAction, reason: string | null, actor: ChangeActionActor) => void;
}

/**
 * The change-request actions.
 *
 * Time impact stops being a number that goes nowhere: on Execute the agreed
 * days actually move the stage they were claimed against, and a time claim
 * (`eot_only`, or one already tied to an EOT claim) awards those days through
 * the extension-of-time module so the revised completion date and the
 * contractual key dates move once, in one place.
 */
export function changeActions(repository: ChangeRequestsRepository, deps: ChangeExecutionDeps) {
  async function owned(projectId: string, id: string): Promise<ChangeRequestRow> {
    const row = await repository.findById(id);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Change request");
    return row;
  }

  async function applyTimeImpact(row: ChangeRequestRow): Promise<void> {
    const days = row.time_impact_days;
    if (days === 0) return;
    if (row.stage_id && deps.shiftStageEnd) {
      await deps.shiftStageEnd(row.project_id, row.stage_id, days);
    }
    const claimsTime = row.type === "eot_only" || row.eot_claim_id !== null;
    if (claimsTime && deps.applyApprovedEot) {
      await deps.applyApprovedEot(row.project_id, days);
    }
  }

  return {
    async run(
      projectId: string,
      id: string,
      action: ChangeAction,
      input: ChangeActionInput,
      actor: ChangeActionActor,
    ): Promise<ChangeRequestRow> {
      const row = await owned(projectId, id);
      assertTransition(action, row.status);
      const reason = assertReason(action, input.reason);
      if (action === "approve" || action === "reject") {
        assertNotSelfDecision(row, actor.id, actor.holdsApproval);
      }

      const now = new Date().toISOString();
      const patch: ChangeRequestUpdatePatch = {
        status: resultingStatus(action),
        updated_at: now,
      };

      if (action === "submit" || action === "resubmit") {
        // Resubmitting is a new version of the same change, not a fresh record:
        // the price and the days may have moved, and the trail says so.
        if (input.costImpact !== undefined) patch.cost_impact = String(input.costImpact);
        if (input.timeImpactDays !== undefined) patch.time_impact_days = input.timeImpactDays;
        patch.submitted_at = now;
        patch.rejected_reason = null;
        patch.decided_at = null;
        patch.decided_by_id = null;
        patch.revisions = JSON.stringify(
          appendRevision(row, actor, {
            costImpact: input.costImpact,
            timeImpactDays: input.timeImpactDays,
            reason,
          }),
        );
      }

      if (action === "approve" || action === "reject") {
        patch.decided_at = now;
        patch.decided_by_id = actor.id;
      }
      if (action === "reject") patch.rejected_reason = reason;

      if (action === "execute") {
        await deps.assertExecutable(row);
      }

      const updated = await repository.update(id, patch);
      if (!updated) throw new NotFoundError("Change request");

      if (action === "approve") await deps.onApproved?.(updated, actor);
      if (action === "execute") await applyTimeImpact(updated);
      deps.onDecided?.(updated, action, reason, actor);

      return updated;
    },

    /** Deleting a change an RFI points at would orphan that RFI's paper trail. */
    async assertRemovable(projectId: string, id: string, referencingRfis: number): Promise<void> {
      const row = await owned(projectId, id);
      if (referencingRfis > 0) {
        throw new BadRequestError(
          "An RFI was converted into this change request — unlink it before deleting the change",
        );
      }
      if (row.status === "Executed") {
        throw new BadRequestError("An executed change is part of the contract — it cannot be deleted");
      }
    },
  };
}

export type ChangeActionsService = ReturnType<typeof changeActions>;
