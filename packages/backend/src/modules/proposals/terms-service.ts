import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTermsRepository } from "./terms-repository.ts";
import type {
  CreatePaymentScheduleInput,
  Estimate,
  PaymentScheduleItem,
  UpdateEstimateTermsInput,
  WHT_RATES,
} from "./types.ts";

type WhtRate = (typeof WHT_RATES)[number];

const PERCENT_TOLERANCE = 0.01;

// Pure rules, exported so the tests can hit them without a repository.

/** A schedule is sendable when its percents make exactly 100 and it has at most one advance, placed first. */
export function validateSchedule(items: Pick<CreatePaymentScheduleInput, "percent" | "kind" | "label">[]): string | null {
  if (items.length === 0) return "Add at least one payment stage.";
  const total = items.reduce((sum, item) => sum + item.percent, 0);
  if (Math.abs(total - 100) > PERCENT_TOLERANCE) {
    return `Payment stages must total 100 %. They currently total ${Math.round(total * 100) / 100} %.`;
  }
  const advances = items.filter((item) => item.kind === "advance");
  if (advances.length > 1) return "Only one advance payment is allowed.";
  if (advances.length === 1 && items[0]?.kind !== "advance") return "The advance payment must be the first stage.";
  if (items.some((item) => item.percent <= 0)) return "Every stage needs a percentage above zero.";
  if (items.some((item) => !item.label.trim())) return "Every stage needs a label.";
  return null;
}

export function validateTerms(patch: UpdateEstimateTermsInput): string | null {
  const pct = (value: number | null | undefined, label: string, max = 100) =>
    value !== null && value !== undefined && (value < 0 || value > max) ? `${label} must be between 0 and ${max}.` : null;
  return (
    pct(patch.retentionPct, "Retention", 20) ??
    pct(patch.advancePct, "Advance", 50) ??
    (patch.whtPct !== null && patch.whtPct !== undefined && ![0, 2, 5].includes(patch.whtPct as WhtRate)
      ? "Withholding tax must be none, 2 % or 5 %."
      : null) ??
    (patch.paymentTermsDays !== null && patch.paymentTermsDays !== undefined && patch.paymentTermsDays < 0
      ? "Payment terms cannot be negative."
      : null) ??
    (patch.defectsLiabilityDays !== null && patch.defectsLiabilityDays !== undefined && patch.defectsLiabilityDays < 0
      ? "Defects liability cannot be negative."
      : null)
  );
}

/** Why a Draft estimate cannot be sent yet, or null when it can. */
export function sendBlocker(estimate: Pick<Estimate, "status">, schedule: PaymentScheduleItem[]): string | null {
  if (estimate.status !== "Draft") return "Only Draft estimates can be sent.";
  return validateSchedule(schedule);
}

export function proposalTermsService(repo: ProposalsRepository, terms: ProposalTermsRepository) {
  async function loadDraft(estimateId: string, proposalId: string, orgId: string) {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new ForbiddenError("No access to this proposal");
    const estimate = await repo.getEstimate(estimateId);
    if (!estimate || estimate.proposalId !== proposalId) throw new NotFoundError("Estimate");
    if (estimate.status !== "Draft") {
      throw new BadRequestError("Only Draft estimates can be edited. Create a new revision to make changes.");
    }
    return { proposal, estimate };
  }

  return {
    async updateTerms(estimateId: string, proposalId: string, orgId: string, patch: UpdateEstimateTermsInput) {
      await loadDraft(estimateId, proposalId, orgId);
      const problem = validateTerms(patch);
      if (problem) throw new BadRequestError(problem);
      const { validUntil, ...estimatePatch } = patch;
      await terms.updateTerms(estimateId, estimatePatch);
      if (validUntil !== undefined) await repo.updateProposal(proposalId, orgId, { validUntil });
      const updated = await repo.getEstimate(estimateId);
      if (!updated) throw new NotFoundError("Estimate");
      return updated;
    },

    async savePaymentSchedule(
      estimateId: string,
      proposalId: string,
      orgId: string,
      schedule: CreatePaymentScheduleInput[],
    ) {
      await loadDraft(estimateId, proposalId, orgId);
      const problem = validateSchedule(schedule);
      if (problem) throw new BadRequestError(problem);
      const ids = schedule.map((_, i) => `sched_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`);
      return repo.replaceSchedule(estimateId, schedule, ids);
    },

    async assertSendable(estimate: Estimate) {
      const schedule = await repo.getSchedule(estimate.id);
      const blocker = sendBlocker(estimate, schedule);
      if (blocker) throw new BadRequestError(blocker);
      return schedule;
    },
  };
}

export type ProposalTermsService = ReturnType<typeof proposalTermsService>;
