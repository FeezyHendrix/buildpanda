import { toContractTerms } from "./contract-terms.ts";
import type {
  BudgetPhase,
  BudgetPhaseRow,
  CashFlowEntry,
  CashFlowEntryRow,
  FinanceEvent,
  FinanceEventRow,
  FinancesRow,
  MaterialProcurement,
  MaterialProcurementRow,
  MilestoneDispute,
  MilestoneDisputeRow,
  MilestonePayment,
  MilestonePaymentRow,
  PaymentLedgerEntry,
  PaymentLedgerRow,
  ProjectFinances,
} from "./types.ts";

/** Row → DTO mapping for the finances module — one concern, one file. */

export function num(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export function toDispute(row: MilestoneDisputeRow): MilestoneDispute {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    raisedBy: { id: row.raised_by_id, name: row.raised_by_name },
    reason: row.reason,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };
}

export function toBudgetPhase(row: BudgetPhaseRow): BudgetPhase {
  return {
    id: row.id,
    name: row.name,
    planned: num(row.planned),
    actual: num(row.actual),
  };
}

export function toMaterial(row: MaterialProcurementRow): MaterialProcurement {
  return {
    id: row.id,
    name: row.name,
    purchasedAt: row.purchased_at,
    receipt: row.receipt,
    amount: num(row.amount),
    thumbnailTone: row.thumbnail_tone,
  };
}

export function toMilestone(row: MilestonePaymentRow): MilestonePayment {
  return {
    id: row.id,
    name: row.name,
    phase: row.phase,
    status: row.status,
    percentComplete: row.percent_complete,
    amount: num(row.amount),
    proof: row.proof_file_name
      ? { fileName: row.proof_file_name, verified: row.proof_verified }
      : null,
    inspectorSignOff: row.inspector_sign_off,
    claimState: row.claim_state ?? "pending",
  };
}

export function toLedgerEntry(row: PaymentLedgerRow): PaymentLedgerEntry {
  return {
    id: row.id,
    date: row.entry_date,
    description: row.description,
    descriptionHtml: row.description_html,
    amount: num(row.amount),
    type: row.type,
  };
}

export function toCashFlowEntry(row: CashFlowEntryRow): CashFlowEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category,
    amount: num(row.amount),
    isCredit: row.is_credit,
    description: row.description,
    entryDate: row.entry_date,
    createdBy: row.created_by_id
      ? { id: row.created_by_id, name: row.created_by_name ?? "" }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    retentionAccrued: num(row.retention_accrued),
  };
}

export function toEvent(row: FinanceEventRow): FinanceEvent {
  return {
    id: row.id,
    type: row.type,
    actor: { id: row.actor_id, name: row.actor_name },
    summary: row.summary,
    amount: row.amount === null ? null : num(row.amount),
    entityId: row.entity_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toFinances(
  summary: FinancesRow,
  budgetPhases: BudgetPhaseRow[],
  materials: MaterialProcurementRow[],
  milestones: MilestonePaymentRow[],
  ledger: PaymentLedgerRow[],
): ProjectFinances {
  const contractSum = num(summary.contract_sum);
  const variationsTotal = num(summary.variations_total);
  return {
    projectId: summary.project_id,
    currency: summary.currency,
    totalBudget: num(summary.total_budget),
    contractSum,
    variationsTotal,
    adjustedContract: contractSum + variationsTotal,
    certifiedGrossToDate: num(summary.certified_gross_to_date),
    amountPaidToDate: num(summary.amount_paid_to_date),
    retentionHeld: num(summary.retention_held),
    advanceRecovered: num(summary.advance_recovered),
    // Deposits and milestone releases are project FUNDING, a ledger of their
    // own; the contract waterfall is fed by certificates, never by these.
    funding: {
      deposited: num(summary.funds_deposited),
      released: num(summary.funds_released),
    },
    contractTerms: toContractTerms(summary),
    budgetAllocation: budgetPhases.map(toBudgetPhase),
    materialsProcured: materials.map(toMaterial),
    milestones: milestones.map(toMilestone),
    ledger: ledger.map(toLedgerEntry),
  };
}
