import { generateId } from "../../lib/ids.ts";
import type { FinancesRepository } from "./repository.ts";
import type { FinanceActor } from "./service.ts";
import type { MilestoneClaimState } from "./types.ts";

// The stage-payment chain: a milestone becomes claimable when its stage is
// reached, a claim marks it claimed, a recorded invoice certifies it, a
// recorded payment closes it. Kept beside the finances service so that file
// does not grow; everything here is a recorded fact about money moved elsewhere.

export const ADVANCE_MILESTONE = /advance|mobili[sz]ation|deposit/i;

export function isAdvanceMilestone(name: string): boolean {
  return ADVANCE_MILESTONE.test(name);
}

export function claimChain(repository: FinancesRepository) {
  async function log(projectId: string, actor: FinanceActor | null, summary: string, amount: number | null, entityId: string | null) {
    try {
      await repository.insertEvent({
        project_id: projectId,
        type: "milestone_updated",
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
    async setMilestoneClaimState(projectId: string, milestoneId: string, state: MilestoneClaimState): Promise<void> {
      await repository.updateMilestone(projectId, milestoneId, { claim_state: state });
    },

    // A stage starting or finishing on site makes the milestones bound to it
    // claimable. Binding is by the stage's name against the milestone's phase
    // today; when the handoff stream lands schedule_item_id links, the
    // repository resolves those first.
    async markStageMilestonesClaimable(
      projectId: string,
      stage: { id: string; name: string },
      actor: FinanceActor | null,
    ): Promise<number> {
      const milestones = await repository.listMilestonesForStage(projectId, stage);
      const pending = milestones.filter((m) => m.claim_state === "pending");
      for (const milestone of pending) {
        await repository.updateMilestone(projectId, milestone.id, { claim_state: "claimable" });
        await log(projectId, actor, `Stage payment now claimable · ${milestone.name} (${stage.name} reached)`, Number(milestone.amount), milestone.id);
      }
      return pending.length;
    },

    async recordCertification(
      projectId: string,
      input: { claimId: string; certified: number; retention: number; advanceRecovery: number; invoiceNumber: string },
      actor: FinanceActor,
    ): Promise<void> {
      await repository.recordCertification(projectId, input);
      await log(
        projectId,
        actor,
        `Recorded invoice ${input.invoiceNumber} · certified ${input.certified}, retention ${input.retention}, advance recovered ${input.advanceRecovery}`,
        input.certified,
        input.claimId,
      );
    },

    async recordClaimPayment(
      projectId: string,
      input: { claimId: string; amount: number; description: string },
      actor: FinanceActor | null,
    ): Promise<void> {
      await repository.recordClaimPayment({
        projectId,
        amount: input.amount,
        entryId: generateId("cfe"),
        description: input.description,
        entryDate: new Date().toISOString().slice(0, 10),
        actor,
      });
      await log(projectId, actor, `Recorded payment received · ${input.description}`, input.amount, input.claimId);
    },
  };
}

export type ClaimChain = ReturnType<typeof claimChain>;
