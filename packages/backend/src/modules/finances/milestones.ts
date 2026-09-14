import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { isAdvanceMilestone } from "./claim-chain.ts";
import { num, toDispute, toMilestone } from "./finance-mapper.ts";
import type { FinancesRepository } from "./repository.ts";
import type {
  CreateMilestoneInput,
  FinanceActor,
  FinancesDeps,
  RaiseDisputeInput,
  UpdateMilestoneInput,
} from "./service.ts";
import type { MilestoneDispute, MilestonePayment } from "./types.ts";

function notifyMilestoneReleased(
  deps: FinancesDeps,
  recipientId: string | null | undefined,
  projectId: string,
  name: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "milestone_released", {
      title: "Milestone payment released",
      body: name,
      projectId,
    })
    .catch(() => undefined);
}

function notifyMilestoneDisputed(
  deps: FinancesDeps,
  recipientId: string | null | undefined,
  projectId: string,
  name: string,
  reason: string,
  actorId: string,
): void {
  if (!deps.notifications || !recipientId || recipientId === actorId) return;
  void deps.notifications
    .notify(recipientId, "milestone_disputed", {
      title: "Milestone payment disputed",
      body: `${name}: ${reason}`,
      projectId,
    })
    .catch(() => undefined);
}

/**
 * Stage payments: milestones and the disputes raised on them.
 *
 * This is the FUNDING ledger — a cost gate the client releases against — and it
 * never feeds the contract waterfall. Releasing a milestone LOGS that a human
 * moved money elsewhere; nothing is transacted here.
 */
export function milestoneService(repository: FinancesRepository, deps: FinancesDeps) {
  // Best-effort audit trail: a logging failure must never break the action that
  // triggered it, so the insert is awaited-and-swallowed.
  async function recordEvent(
    projectId: string,
    type: "milestone_created" | "milestone_updated" | "milestone_deleted" | "milestone_released" | "dispute_raised",
    actor: FinanceActor | null,
    summary: string,
    amount: number | null,
    entityId: string | null,
  ): Promise<void> {
    try {
      await repository.insertEvent({
        project_id: projectId,
        type,
        actor_id: actor?.id ?? null,
        actor_name: actor?.name ?? "System",
        summary,
        amount,
        entity_id: entityId,
      });
    } catch {
      void 0;
    }
  }

  return {
    async createMilestone(
      projectId: string,
      input: CreateMilestoneInput,
      actor?: FinanceActor,
    ): Promise<MilestonePayment> {
      if (input.amount < 0) throw new BadRequestError("Milestone amount cannot be negative");
      const row = await repository.createMilestone({
        id: generateId("milestone"),
        project_id: projectId,
        name: input.name,
        phase: input.phase,
        status: input.status ?? "Pending",
        percent_complete: input.percentComplete ?? 0,
        amount: String(input.amount),
        proof_file_name: null,
        proof_verified: false,
        inspector_sign_off: input.inspectorSignOff ?? "Pending",
        // the advance is claimable the moment the contract exists
        claim_state: isAdvanceMilestone(input.name) ? "claimable" : "pending",
      });
      await recordEvent(projectId, "milestone_created", actor ?? null, `Added milestone · ${row.name}`, input.amount, row.id);
      return toMilestone(row);
    },

    async updateMilestone(
      projectId: string,
      milestoneId: string,
      input: UpdateMilestoneInput,
      actor?: FinanceActor,
    ): Promise<MilestonePayment> {
      if (input.amount !== undefined && input.amount < 0) {
        throw new BadRequestError("Milestone amount cannot be negative");
      }
      const row = await repository.updateMilestone(projectId, milestoneId, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phase !== undefined ? { phase: input.phase } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.percentComplete !== undefined
          ? { percent_complete: input.percentComplete }
          : {}),
        ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
        ...(input.inspectorSignOff !== undefined
          ? { inspector_sign_off: input.inspectorSignOff }
          : {}),
      });
      if (!row) throw new NotFoundError("Milestone");
      await recordEvent(projectId, "milestone_updated", actor ?? null, `Updated milestone · ${row.name}`, num(row.amount), row.id);
      return toMilestone(row);
    },

    async deleteMilestone(projectId: string, milestoneId: string, actor?: FinanceActor): Promise<void> {
      const existing = await repository.findMilestone(milestoneId);
      const deleted = await repository.deleteMilestone(projectId, milestoneId);
      if (deleted === 0) throw new NotFoundError("Milestone");
      await recordEvent(
        projectId,
        "milestone_deleted",
        actor ?? null,
        `Removed milestone · ${existing?.name ?? milestoneId}`,
        existing ? num(existing.amount) : null,
        milestoneId,
      );
    },

    async releaseMilestone(
      projectId: string,
      milestoneId: string,
      actor: FinanceActor,
    ): Promise<MilestonePayment> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone) throw new NotFoundError("Milestone");
      if (milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const updated = await repository.releaseMilestone({
        projectId,
        milestoneId,
        entryDate: new Date().toISOString().slice(0, 10),
        description: `Release · ${milestone.name}`,
        ledgerId: generateId("ledger"),
      });
      const projectOwnerId = await repository.projectOwnerId(projectId);
      notifyMilestoneReleased(deps, projectOwnerId, projectId, updated.name, actor.id);
      await recordEvent(projectId, "milestone_released", actor, `Released milestone from escrow · ${updated.name}`, num(updated.amount), milestoneId);
      return toMilestone(updated);
    },

    async listDisputes(
      projectId: string,
      milestoneId: string,
    ): Promise<MilestoneDispute[]> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone || milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const rows = await repository.listDisputesForMilestone(milestoneId);
      return rows.map(toDispute);
    },

    async raiseDispute(
      projectId: string,
      milestoneId: string,
      input: RaiseDisputeInput,
      actor: { id: string; name: string },
    ): Promise<MilestoneDispute> {
      const milestone = await repository.findMilestone(milestoneId);
      if (!milestone || milestone.project_id !== projectId) {
        throw new NotFoundError("Milestone");
      }
      const row = await repository.createDispute({
        id: generateId("dispute"),
        milestone_id: milestoneId,
        raised_by_id: actor.id,
        raised_by_name: actor.name,
        reason: input.reason,
      });
      const projectOwnerId = await repository.projectOwnerId(projectId);
      notifyMilestoneDisputed(deps, projectOwnerId, projectId, milestone.name, input.reason, actor.id);
      await recordEvent(projectId, "dispute_raised", actor, `Raised dispute · ${milestone.name}`, num(milestone.amount), milestoneId);
      return toDispute(row);
    },
  };
}

export type MilestoneService = ReturnType<typeof milestoneService>;
