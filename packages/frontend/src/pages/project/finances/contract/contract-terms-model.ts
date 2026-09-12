import type {
  AdvanceRecoveryMode,
  ContractType,
  ProjectFinances,
  RetentionReleaseMode,
  UpdateContractTermsInput,
} from "@/lib/project-types";

export const CONTRACT_TYPE_LABELS: Record<ContractType, { label: string; hint: string }> = {
  lump_sum: {
    label: "Lump sum",
    hint: "Fixed total price for a fully defined scope.",
  },
  cost_plus: {
    label: "Cost plus",
    hint: "Contractor bills cost + agreed fee or markup.",
  },
  unit_rate: {
    label: "Unit rate / re-measurement",
    hint: "Price per measured unit; final total known at completion.",
  },
  gmp: {
    label: "Guaranteed maximum price",
    hint: "Cost-plus with a cap agreed up-front.",
  },
  design_build: {
    label: "Design–build",
    hint: "Single party responsible for design and construction.",
  },
  target_cost: {
    label: "Target cost",
    hint: "Shared pain/gain against an agreed target price.",
  },
};

export const RETENTION_MODE_LABELS: Record<RetentionReleaseMode, { label: string; hint: string }> = {
  all_at_practical_completion: {
    label: "Released at practical completion",
    hint: "Full retention returned once the works reach practical completion.",
  },
  staged_pc_dlp: {
    label: "Staged (50% at PC, 50% at DLP)",
    hint: "Half at practical completion, remainder after defects liability.",
  },
  all_at_dlp: {
    label: "Released at end of defects liability",
    hint: "Full retention held until the defects liability period ends.",
  },
};

export const ADVANCE_MODE_LABELS: Record<AdvanceRecoveryMode, { label: string; hint: string }> = {
  percentage: {
    label: "Percentage of each certification",
    hint: "A % of every certified payment is applied to the advance.",
  },
  fixed: {
    label: "Fixed amount per certification",
    hint: "A fixed sum is applied to the advance until fully recovered.",
  },
};

export interface ContractTermsForm {
  contractSum: string;
  contractType: ContractType;
  retentionRatePercent: string;
  retentionReleaseMode: RetentionReleaseMode;
  advancePercentagePercent: string;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: string;
  paymentTermsDays: string;
  defectsLiabilityDays: string;
  contractNotes: string;
}

export function toForm(finances: ProjectFinances): ContractTermsForm {
  const terms = finances.contractTerms;
  return {
    contractSum: finances.contractSum ? finances.contractSum.toString() : "",
    contractType: terms.contractType,
    retentionRatePercent: (terms.retentionRate * 100).toString(),
    retentionReleaseMode: terms.retentionReleaseMode,
    advancePercentagePercent: (terms.advancePercentage * 100).toString(),
    advanceRecoveryMode: terms.advanceRecoveryMode,
    advanceRecoveryRate: terms.advanceRecoveryRate.toString(),
    paymentTermsDays: terms.paymentTermsDays.toString(),
    defectsLiabilityDays: terms.defectsLiabilityDays.toString(),
    contractNotes: terms.contractNotes ?? "",
  };
}

/** Only the fields that changed go on the wire; null means nothing to save. */
export function diffToPatch(
  next: ContractTermsForm,
  finances: ProjectFinances,
): UpdateContractTermsInput | null {
  const base = finances.contractTerms;
  const patch: UpdateContractTermsInput = {};
  const nextContractSum = Number(next.contractSum);
  if (
    next.contractSum.trim().length > 0 &&
    Number.isFinite(nextContractSum) &&
    nextContractSum !== finances.contractSum
  ) {
    patch.contractSum = nextContractSum;
  }
  if (next.contractType !== base.contractType) {
    patch.contractType = next.contractType;
  }
  const nextRetention = Number(next.retentionRatePercent) / 100;
  if (Number.isFinite(nextRetention) && nextRetention !== base.retentionRate) {
    patch.retentionRate = nextRetention;
  }
  if (next.retentionReleaseMode !== base.retentionReleaseMode) {
    patch.retentionReleaseMode = next.retentionReleaseMode;
  }
  const nextAdvance = Number(next.advancePercentagePercent) / 100;
  if (Number.isFinite(nextAdvance) && nextAdvance !== base.advancePercentage) {
    patch.advancePercentage = nextAdvance;
  }
  if (next.advanceRecoveryMode !== base.advanceRecoveryMode) {
    patch.advanceRecoveryMode = next.advanceRecoveryMode;
  }
  const nextRecoveryRate = Number(next.advanceRecoveryRate);
  if (
    Number.isFinite(nextRecoveryRate) &&
    nextRecoveryRate !== base.advanceRecoveryRate
  ) {
    patch.advanceRecoveryRate = nextRecoveryRate;
  }
  const nextPaymentDays = Number(next.paymentTermsDays);
  if (
    Number.isInteger(nextPaymentDays) &&
    nextPaymentDays >= 0 &&
    nextPaymentDays !== base.paymentTermsDays
  ) {
    patch.paymentTermsDays = nextPaymentDays;
  }
  const nextDefectsDays = Number(next.defectsLiabilityDays);
  if (
    Number.isInteger(nextDefectsDays) &&
    nextDefectsDays >= 0 &&
    nextDefectsDays !== base.defectsLiabilityDays
  ) {
    patch.defectsLiabilityDays = nextDefectsDays;
  }
  const nextNotes = next.contractNotes.trim();
  const baseNotes = base.contractNotes ?? "";
  if (nextNotes !== baseNotes) {
    patch.contractNotes = nextNotes.length > 0 ? nextNotes : null;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}
