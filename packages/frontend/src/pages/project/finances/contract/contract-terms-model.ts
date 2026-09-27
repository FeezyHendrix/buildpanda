import type {
  AdvanceRecoveryMode,
  ContractForm,
  ContractType,
  ProjectFinances,
  RetentionReleaseMode,
  UpdateContractTermsInput,
  ValuationFrequency,
} from "@/lib/project-types";

/**
 * The contract terms form.
 *
 * Every rate is a PERCENTAGE in the UI and a FRACTION on the wire — the
 * conversion happens here and nowhere else, which is what stops a retention
 * rate of 0.05 sitting next to an advance recovery rate of 10 and a consumer
 * getting one of them wrong by 100×. Liquidated damages are the one
 * money-per-day figure and pass through untouched.
 */

export const CONTRACT_TYPE_LABELS: Record<ContractType, { label: string; hint: string }> = {
  lump_sum: { label: "Lump sum", hint: "Fixed total price for a fully defined scope." },
  cost_plus: { label: "Cost plus", hint: "Contractor bills cost + agreed fee or markup." },
  unit_rate: {
    label: "Unit rate / re-measurement",
    hint: "Price per measured unit; final total known at completion.",
  },
  gmp: { label: "Guaranteed maximum price", hint: "Cost-plus with a cap agreed up-front." },
  design_build: {
    label: "Design–build",
    hint: "Single party responsible for design and construction.",
  },
  target_cost: { label: "Target cost", hint: "Shared pain/gain against an agreed target price." },
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

export const CONTRACT_FORM_LABELS: Record<ContractForm, string> = {
  fidic_red: "FIDIC Red Book",
  fidic_yellow: "FIDIC Yellow Book",
  jct: "JCT",
  nec: "NEC",
  bespoke: "Bespoke",
};

export const VALUATION_FREQUENCY_LABELS: Record<ValuationFrequency, string> = {
  monthly: "Monthly interim valuations",
  milestone: "On milestone completion",
};

export interface ContractTermsForm {
  contractSum: string;
  contractType: ContractType;
  contractForm: string;
  employerName: string;
  contractorName: string;
  commencementDate: string;
  completionDate: string;
  valuationFrequency: ValuationFrequency;
  vatRatePercent: string;
  liquidatedDamagesRate: string;
  liquidatedDamagesCapPercent: string;
  retentionRatePercent: string;
  retentionCapPercent: string;
  retentionReleaseMode: RetentionReleaseMode;
  advancePercentagePercent: string;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: string;
  advanceRecoveryFromCertificate: string;
  paymentTermsDays: string;
  defectsPeriodMonths: string;
  contractNotes: string;
}

/** A fraction as the percentage the form shows, without float dust (0.075 → "7.5"). */
function toPercent(fraction: number): string {
  return String(Math.round(fraction * 1_000_000) / 10_000);
}

export function toForm(finances: ProjectFinances): ContractTermsForm {
  const terms = finances.contractTerms;
  return {
    contractSum: finances.contractSum ? finances.contractSum.toString() : "",
    contractType: terms.contractType,
    contractForm: terms.contractForm ?? "",
    employerName: terms.employerName ?? "",
    contractorName: terms.contractorName ?? "",
    commencementDate: terms.commencementDate ?? "",
    completionDate: terms.completionDate ?? "",
    valuationFrequency: terms.valuationFrequency,
    vatRatePercent: toPercent(terms.vatRate),
    liquidatedDamagesRate: terms.liquidatedDamagesRate.toString(),
    liquidatedDamagesCapPercent: toPercent(terms.liquidatedDamagesCapPercent),
    retentionRatePercent: toPercent(terms.retentionRate),
    retentionCapPercent: toPercent(terms.retentionCapPercent),
    retentionReleaseMode: terms.retentionReleaseMode,
    advancePercentagePercent: toPercent(terms.advancePercentage),
    advanceRecoveryMode: terms.advanceRecoveryMode,
    // A percentage recovery is a rate like any other; a fixed recovery is money.
    advanceRecoveryRate:
      terms.advanceRecoveryMode === "percentage"
        ? toPercent(terms.advanceRecoveryRate)
        : terms.advanceRecoveryRate.toString(),
    advanceRecoveryFromCertificate: String(terms.advanceRecoveryFromCertificate),
    paymentTermsDays: terms.paymentTermsDays.toString(),
    defectsPeriodMonths: terms.defectsPeriodMonths.toString(),
    contractNotes: terms.contractNotes ?? "",
  };
}

/** A percentage field as the fraction the API stores, or undefined when unusable. */
function fraction(value: string): number | undefined {
  if (value.trim().length === 0) return undefined;
  const parsed = Number(value) / 100;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

function wholeDays(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function money(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  if (next.contractType !== base.contractType) patch.contractType = next.contractType;
  if (next.retentionReleaseMode !== base.retentionReleaseMode) {
    patch.retentionReleaseMode = next.retentionReleaseMode;
  }
  if (next.advanceRecoveryMode !== base.advanceRecoveryMode) {
    patch.advanceRecoveryMode = next.advanceRecoveryMode;
  }
  if (next.valuationFrequency !== base.valuationFrequency) {
    patch.valuationFrequency = next.valuationFrequency;
  }

  const rates: [keyof UpdateContractTermsInput, number | undefined, number][] = [
    ["retentionRate", fraction(next.retentionRatePercent), base.retentionRate],
    ["retentionCapPercent", fraction(next.retentionCapPercent), base.retentionCapPercent],
    ["advancePercentage", fraction(next.advancePercentagePercent), base.advancePercentage],
    ["vatRate", fraction(next.vatRatePercent), base.vatRate],
    [
      "liquidatedDamagesCapPercent",
      fraction(next.liquidatedDamagesCapPercent),
      base.liquidatedDamagesCapPercent,
    ],
  ];
  for (const [key, value, current] of rates) {
    if (value !== undefined && value !== current) Object.assign(patch, { [key]: value });
  }

  // A percentage recovery converts like every other rate; a fixed one is money.
  const nextRecovery =
    next.advanceRecoveryMode === "percentage"
      ? fraction(next.advanceRecoveryRate)
      : money(next.advanceRecoveryRate);
  if (nextRecovery !== undefined && nextRecovery !== base.advanceRecoveryRate) {
    patch.advanceRecoveryRate = nextRecovery;
  }

  const ldRate = money(next.liquidatedDamagesRate);
  if (ldRate !== undefined && ldRate !== base.liquidatedDamagesRate) {
    patch.liquidatedDamagesRate = ldRate;
  }

  const recoveryFrom = Number(next.advanceRecoveryFromCertificate);
  if (
    Number.isInteger(recoveryFrom) &&
    recoveryFrom >= 1 &&
    recoveryFrom !== base.advanceRecoveryFromCertificate
  ) {
    patch.advanceRecoveryFromCertificate = recoveryFrom;
  }

  const paymentDays = wholeDays(next.paymentTermsDays);
  if (paymentDays !== undefined && paymentDays !== base.paymentTermsDays) {
    patch.paymentTermsDays = paymentDays;
  }
  const defectsMonths = wholeDays(next.defectsPeriodMonths);
  if (defectsMonths !== undefined && defectsMonths !== base.defectsPeriodMonths) {
    patch.defectsPeriodMonths = defectsMonths;
  }

  const commencement = text(next.commencementDate);
  if (commencement !== (base.commencementDate ?? null)) patch.commencementDate = commencement;
  const completion = text(next.completionDate);
  if (completion !== (base.completionDate ?? null)) patch.completionDate = completion;
  const employer = text(next.employerName);
  if (employer !== (base.employerName ?? null)) patch.employerName = employer;
  const contractor = text(next.contractorName);
  if (contractor !== (base.contractorName ?? null)) patch.contractorName = contractor;
  const form = text(next.contractForm);
  if (form !== (base.contractForm ?? null)) patch.contractForm = form as ContractForm | null;
  const notes = text(next.contractNotes);
  if (notes !== (base.contractNotes ?? null)) patch.contractNotes = notes;

  return Object.keys(patch).length === 0 ? null : patch;
}
