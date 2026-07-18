import type { Currency, Tone } from "../projects/types.ts";

export type MilestoneStatus = "Completed" | "InProgress" | "Pending";
export type SignOffStatus = "Verified" | "Scheduled" | "Pending";
export type LedgerType = "Release" | "Deposit" | "Hold";

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
  fundsDeposited: number;
  fundsReleased: number;
  lockedInEscrow: number;
  remainingBalance: number;
  budgetAllocation: BudgetPhase[];
  materialsProcured: MaterialProcurement[];
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export interface FinancesRow {
  project_id: string;
  currency: Currency;
  total_budget: string;
  funds_deposited: string;
  funds_released: string;
  locked_in_escrow: string;
  remaining_balance: string;
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

export const FINANCE_EVENT_TYPES = [
  "deposit",
  "milestone_released",
  "milestone_created",
  "milestone_updated",
  "milestone_deleted",
  "dispute_raised",
] as const;
export type FinanceEventType = (typeof FINANCE_EVENT_TYPES)[number];

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

export interface NewFinanceEventRecord {
  project_id: string;
  type: FinanceEventType;
  actor_id: string | null;
  actor_name: string;
  summary: string;
  amount?: number | null;
  entity_id?: string | null;
}
