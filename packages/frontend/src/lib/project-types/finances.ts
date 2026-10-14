import type { MilestoneStatus, SignOffStatus, MilestoneClaimState, LedgerType, Currency, DisputeStatus } from "./common";
import type { ContractTerms } from "./contracts";
import type { BudgetPhase } from "./project";

export interface MilestonePayment {
  id: string;
  name: string;
  phase: string;
  status: MilestoneStatus;
  percentComplete: number;
  amount: number;
  proof: { fileName: string; verified: boolean } | null;
  inspectorSignOff: SignOffStatus;
  claimState: MilestoneClaimState;
}

export interface PaymentLedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: LedgerType;
}

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
  milestones: MilestonePayment[];
  ledger: PaymentLedgerEntry[];
}

export type FinanceEventType =
  | "deposit"
  | "milestone_released"
  | "milestone_created"
  | "milestone_updated"
  | "milestone_deleted"
  | "dispute_raised"
  | "cash_flow_entry";

export interface FinanceEvent {
  id: string;
  type: FinanceEventType;
  actor: { id: string | null; name: string };
  summary: string;
  amount: number | null;
  entityId: string | null;
  createdAt: string;
}

export interface MilestoneDispute {
  id: string;
  milestoneId: string;
  raisedBy: { id: string; name: string };
  reason: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

// ── Payment methods / contract settings ──────────────────────────────────

export type PaymentModel = "lump_sum" | "remeasurement" | "cost_plus" | "project_finance";

export interface PaymentSettings {
  paymentModels: PaymentModel[];
  mobilizationAdvance: number;
  mobilizationOutstanding: number;
  mobilizationAmortType: "percent" | "fixed" | null;
  mobilizationAmortValue: number;
  retentionHeld: number;
  retentionReleasedPc: number;
  retentionReleasedDl: number;
  retentionRate: number;
}

export interface RetentionRelease {
  id: string;
  projectId: string;
  stage: number;
  amount: number;
  status: "Pending" | "Released" | "Disputed";
  releasedAt: string | null;
  releasedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AdvanceAmortization {
  id: string;
  projectId: string;
  milestoneId: string | null;
  amount: number;
  recoveredAt: string;
}

export interface MeasuredWorkRecord {
  id: string;
  projectId: string;
  milestoneId: string | null;
  description: string;
  unit: string;
  quantity: number;
  unitRate: number;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  certifiedBy: string | null;
  certifiedAt: string | null;
  status: "Draft" | "Certified" | "Invoiced";
  createdAt: string;
}

export interface FinalAccount {
  id: string;
  projectId: string;
  status: "Draft" | "Submitted" | "Agreed" | "Disputed" | "Settled";
  totalContract: number;
  variationsTotal: number;
  claimsTotal: number;
  retentionTotal: number;
  advanceRecovered: number;
  amountPaid: number;
  netSettlement: number;
  agreedAt: string | null;
  agreedBy: string | null;
  notes: string | null;
  createdAt: string;
}
