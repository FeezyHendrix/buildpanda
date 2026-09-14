import type { Currency } from "../projects/types.ts";
import type {
  AdvanceRecoveryMode,
  ContractType,
  RetentionReleaseMode,
} from "./types.ts";

/**
 * The contract as a commercial instrument: its terms, and the position those
 * terms produce.
 *
 * Certification comes only from approved receivable certificates and payment
 * only from the receipts recorded against them. Funding deposits and stage
 * milestones are a separate ledger and never feed the contract waterfall.
 */

export const CONTRACT_FORMS = ["fidic_red", "fidic_yellow", "jct", "nec", "bespoke"] as const;
export type ContractForm = (typeof CONTRACT_FORMS)[number];

export const VALUATION_FREQUENCIES = ["monthly", "milestone"] as const;
export type ValuationFrequency = (typeof VALUATION_FREQUENCIES)[number];

/**
 * Every rate here is a FRACTION (0.05 = 5%), stored and exposed the same way,
 * so a consumer never has to guess which of two neighbouring fields is a
 * percentage. `liquidatedDamagesRate` is the only money-per-day figure.
 */
export interface ContractTerms {
  contractType: ContractType;
  retentionRate: number;
  retentionReleaseMode: RetentionReleaseMode;
  /** Retention stops accruing once held retention reaches this share of the contract. 0 = uncapped. */
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

/** The contract-terms request body. Rates arrive as fractions, dates as YYYY-MM-DD. */
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
  contractForm?: string | null;
  valuationFrequency?: ValuationFrequency;
  contractNotes?: string | null;
}

/** The project_finances columns a terms update may write. */
export interface ContractTermsPatch {
  contract_type?: ContractType;
  retention_rate?: number;
  retention_release_mode?: RetentionReleaseMode;
  retention_cap_percent?: number;
  advance_percentage?: number;
  advance_recovery_mode?: AdvanceRecoveryMode;
  advance_recovery_rate?: number;
  advance_recovery_from_certificate?: number;
  payment_terms_days?: number;
  defects_liability_days?: number;
  defects_period_months?: number;
  vat_rate?: number;
  liquidated_damages_rate?: number;
  liquidated_damages_cap_percent?: number;
  commencement_date?: string | null;
  completion_date?: string | null;
  employer_name?: string | null;
  contractor_name?: string | null;
  contract_form?: string | null;
  valuation_frequency?: ValuationFrequency;
  contract_notes?: string | null;
}


// ── The one money model ───────────────────────────────────────────────────
// Certification comes from approved/paid RECEIVABLE invoices and payment from
// the payments recorded on them — nothing else. Funding deposits and stage
// milestones are a separate ledger (a homeowner-escrow concept) and never feed
// the contract waterfall.

export interface CertifiedTotalsRow {
  certified: string;
  retention: string;
  advance_recovered: string;
  certificates: string;
}

export interface ProjectDatesRow {
  completion_date: string | Date | null;
  revised_completion_date: string | Date | null;
}

export interface EotDaysRow {
  approved: string;
  pending: string;
}

/** A stage's scheduled value and estimate, the two candidate budgets for variance. */
export interface StageBudgetInput {
  stageId: string;
  name: string;
  scheduledValue: number;
  expectedCost: number;
}

/** Funding put into the project and released from it. Never part of the waterfall. */
export interface FundingPosition {
  deposited: number;
  released: number;
}

/** Liquidated damages the employer could levy: days late × rate, capped. */
export interface LdExposure {
  daysLate: number;
  ratePerDay: number;
  capAmount: number | null;
  amount: number;
  /** The date lateness is measured against — the revised completion when an EOT moved it. */
  againstDate: string;
}

/** Approved and pending extension-of-time days, off the change requests that claim time. */
export interface EotPosition {
  daysApproved: number;
  daysPending: number;
}

/** Cost against budget for one build stage, saying where the budget figure came from. */
export interface StageBudgetLine {
  stageId: string;
  name: string;
  scheduledValue: number;
  budget: number;
  /** "expected_cost" when an estimate was entered, "scheduled_value" when it falls back. */
  budgetSource: "expected_cost" | "scheduled_value";
  committed: number;
  actual: number;
  variance: number;
}

export interface FinanceSummary {
  projectId: string;
  currency: Currency;
  contractSum: number;
  variationsTotal: number;
  adjustedContract: number;
  /** Gross certified: the sum of Approved/Paid receivable invoices, voided ones excluded. */
  certifiedGrossToDate: number;
  /** Payments recorded against those receivable invoices. */
  amountPaidToDate: number;
  retentionHeld: number;
  advanceRecovered: number;
  /** Still to certify: adjusted contract − certified. */
  outstanding: number;
  /** Certified but not yet received. */
  unpaidCertified: number;
  funding: FundingPosition;
  ldExposure: LdExposure | null;
  eot: EotPosition | null;
  completionDate: string | null;
  revisedCompletionDate: string | null;
  phases: StageBudgetLine[];
}
