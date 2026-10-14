

export const CONTRACT_TYPES = [
  "lump_sum",
  "cost_plus",
  "unit_rate",
  "gmp",
  "design_build",
  "target_cost",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const RETENTION_RELEASE_MODES = [
  "all_at_practical_completion",
  "staged_pc_dlp",
  "all_at_dlp",
] as const;
export type RetentionReleaseMode = (typeof RETENTION_RELEASE_MODES)[number];

export const ADVANCE_RECOVERY_MODES = ["percentage", "fixed"] as const;
export type AdvanceRecoveryMode = (typeof ADVANCE_RECOVERY_MODES)[number];

export const CONTRACT_FORMS = ["fidic_red", "fidic_yellow", "jct", "nec", "bespoke"] as const;
export type ContractForm = (typeof CONTRACT_FORMS)[number];

export const VALUATION_FREQUENCIES = ["monthly", "milestone"] as const;
export type ValuationFrequency = (typeof VALUATION_FREQUENCIES)[number];

/**
 * Every rate here is a FRACTION on the wire (0.05 = 5%) — the UI shows a
 * percentage and converts at the form boundary, so a consumer never has to
 * guess which of two neighbouring fields is which.
 * `liquidatedDamagesRate` is the one money-per-day figure.
 */
export interface ContractTerms {
  contractType: ContractType;
  retentionRate: number;
  retentionReleaseMode: RetentionReleaseMode;
  /** Retention stops accruing at this share of the contract. 0 = uncapped. */
  retentionCapPercent: number;
  advancePercentage: number;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: number;
  /** Recovery of the advance starts on this certificate number (IPC 2 by default). */
  advanceRecoveryFromCertificate: number;
  paymentTermsDays: number;
  defectsLiabilityDays: number;
  defectsPeriodMonths: number;
  vatRate: number;
  /** Money per calendar day late — not a fraction. */
  liquidatedDamagesRate: number;
  /** LDs stop accruing at this share of the adjusted contract. 0 = uncapped. */
  liquidatedDamagesCapPercent: number;
  commencementDate: string | null;
  completionDate: string | null;
  employerName: string | null;
  contractorName: string | null;
  contractForm: ContractForm | null;
  valuationFrequency: ValuationFrequency;
  contractNotes: string | null;
}

export interface UpdateContractTermsInput {
  contractSum?: number;
  contractType?: ContractType;
  retentionRate?: number;
  retentionReleaseMode?: RetentionReleaseMode;
  retentionCapPercent?: number;
  advancePercentage?: number;
  advanceRecoveryMode?: AdvanceRecoveryMode;
  advanceRecoveryRate?: number;
  advanceRecoveryFromCertificate?: number;
  paymentTermsDays?: number;
  defectsLiabilityDays?: number;
  defectsPeriodMonths?: number;
  vatRate?: number;
  liquidatedDamagesRate?: number;
  liquidatedDamagesCapPercent?: number;
  commencementDate?: string | null;
  completionDate?: string | null;
  employerName?: string | null;
  contractorName?: string | null;
  contractForm?: ContractForm | null;
  valuationFrequency?: ValuationFrequency;
  contractNotes?: string | null;
}
