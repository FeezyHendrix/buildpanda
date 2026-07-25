import type { Currency, Tone } from "../projects/types.ts";

export type MilestoneStatus = "Completed" | "InProgress" | "Pending";
export type SignOffStatus = "Verified" | "Scheduled" | "Pending";
export type LedgerType = "Release" | "Deposit" | "Hold";

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

export interface ContractTerms {
  contractType: ContractType;
  retentionRate: number;
  retentionReleaseMode: RetentionReleaseMode;
  advancePercentage: number;
  advanceRecoveryMode: AdvanceRecoveryMode;
  advanceRecoveryRate: number;
  paymentTermsDays: number;
  defectsLiabilityDays: number;
  contractNotes: string | null;
}

export interface BudgetPhase {
  id: string;
  name: string;
  planned: number;
  actual: number;
}

export interface MaterialProcurement {
  id: string;
  name: string;
  purchasedAt: string;
  receipt: string;
  amount: number;
  thumbnailTone: Tone;
}

export interface MilestonePayment {
  id: string;
  name: string;
  phase: string;
  status: MilestoneStatus;
  percentComplete: number;
  amount: number;
  proof: { fileName: string; verified: boolean } | null;
  inspectorSignOff: SignOffStatus;
}

export interface PaymentLedgerEntry {
  id: string;
  date: string;
  description: string;
  descriptionHtml: string | null;
  amount: number;
  type: LedgerType;
}

export interface ProjectFinances {
  projectId: string;
  currency: Currency;
  totalBudget: number;
  contractSum: number;
  variationsTotal: number;
  adjustedContract: number;
  certifiedGrossToDate: number;
  amountPaidToDate: number;
  contractTerms: ContractTerms;
  budgetAllocation: BudgetPhase[];
  materialsProcured: MaterialProcurement[];
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export interface FinancesRow {
  project_id: string;
  currency: Currency;
  total_budget: string;
  contract_sum: string;
  variations_total: string;
  certified_gross_to_date: string;
  amount_paid_to_date: string;
  contract_type: ContractType;
  retention_rate: string;
  retention_release_mode: RetentionReleaseMode;
  advance_percentage: string;
  advance_recovery_mode: AdvanceRecoveryMode;
  advance_recovery_rate: string;
  advance_recovered: string;
  payment_terms_days: number;
  defects_liability_days: number;
  contract_notes: string | null;
}

export interface BudgetPhaseRow {
  id: string;
  project_id: string;
  building_id: string;
  name: string;
  planned: string;
  actual: string;
  sort_order: number;
}

export interface MaterialProcurementRow {
  id: string;
  project_id: string;
  name: string;
  purchased_at: string;
  receipt: string;
  amount: string;
  thumbnail_tone: Tone;
  sort_order: number;
}

export interface MilestonePaymentRow {
  id: string;
  project_id: string;
  building_id: string;
  name: string;
  phase: string;
  status: MilestoneStatus;
  percent_complete: number;
  amount: string;
  proof_file_name: string | null;
  proof_verified: boolean;
  inspector_sign_off: SignOffStatus;
  sort_order: number;
}

export interface PaymentLedgerRow {
  id: string;
  project_id: string;
  building_id: string;
  entry_date: string;
  description: string;
  description_html: string | null;
  amount: string;
  type: LedgerType;
  sort_order: number;
}

export type DisputeStatus = "Open" | "Resolved" | "Withdrawn";

export interface MilestoneDispute {
  id: string;
  milestoneId: string;
  raisedBy: { id: string; name: string };
  reason: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MilestoneDisputeRow {
  id: string;
  milestone_id: string;
  raised_by_id: string;
  raised_by_name: string;
  reason: string;
  status: DisputeStatus;
  created_at: Date | string;
  resolved_at: Date | string | null;
}

export const CASH_FLOW_CATEGORIES = ["valuation", "milestone_payment", "claims_payment"] as const;

export const FINANCE_EVENT_TYPES = [
  "deposit",
  "milestone_released",
  "milestone_created",
  "milestone_updated",
  "milestone_deleted",
  "dispute_raised",
  "cash_flow_entry",
] as const;
export type FinanceEventType = (typeof FINANCE_EVENT_TYPES)[number];

export type CashFlowCategory = "valuation" | "milestone_payment" | "claims_payment";

export interface CashFlowEntry {
  id: string;
  projectId: string;
  category: CashFlowCategory;
  amount: number;
  isCredit: boolean;
  description: string | null;
  entryDate: string;
  createdBy: { id: string | null; name: string } | null;
  createdAt: string;
  retentionAccrued: number;
}

export interface CashFlowEntryRow {
  id: string;
  project_id: string;
  category: CashFlowCategory;
  amount: string;
  is_credit: boolean;
  description: string | null;
  entry_date: string;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: Date | string;
  sort_order: number;
  retention_accrued: string;
}

export interface NewCashFlowEntryRecord {
  id: string;
  project_id: string;
  category: CashFlowCategory;
  amount: number;
  is_credit: boolean;
  description: string | null;
  entry_date: string;
  created_by_id: string | null;
  created_by_name: string | null;
  sort_order: number;
  retention_accrued?: number;
}

export interface FinanceEvent {
  id: string;
  type: FinanceEventType;
  actor: { id: string | null; name: string };
  summary: string;
  amount: number | null;
  entityId: string | null;
  createdAt: string;
}

export interface FinanceEventRow {
  id: string;
  project_id: string;
  type: FinanceEventType;
  actor_id: string | null;
  actor_name: string;
  summary: string;
  amount: string | null;
  entity_id: string | null;
  created_at: Date | string;
}

// ── Payment-methods shared types (rows for separate DB tables) ────────────

export type PaymentModel = "lump_sum" | "remeasurement" | "cost_plus" | "project_finance";
export type AmortType = "percent" | "fixed";

export interface AdvanceAmortizationRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  amount: string;
  ledger_entry_id: string;
  recovered_at: Date | string;
}

export interface RetentionReleaseRow {
  id: string;
  project_id: string;
  stage: number;
  amount: string;
  status: string;
  released_at: string | null;
  released_by: string | null;
  notes: string | null;
  created_at: Date | string;
}

export interface MeasuredWorkRecordRow {
  id: string;
  project_id: string;
  milestone_id: string | null;
  description: string;
  unit: string;
  quantity: string;
  unit_rate: string;
  amount: string;
  period_start: string | null;
  period_end: string | null;
  certified_by: string | null;
  certified_at: string | null;
  status: string;
  created_at: Date | string;
}

export interface FinalAccountRow {
  id: string;
  project_id: string;
  status: string;
  total_contract: string;
  variations_total: string;
  claims_total: string;
  retention_total: string;
  advance_recovered: string;
  amount_paid: string;
  net_settlement: string;
  agreed_at: string | null;
  agreed_by: string | null;
  notes: string | null;
  created_at: Date | string;
}

export interface NewFinanceEventRecord {
  project_id: string;
  type: FinanceEventType;
  actor_id: string | null;
  actor_name: string;
  summary: string;
  amount?: number | null;
  entity_id?: string | null;
}
