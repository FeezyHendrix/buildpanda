export type PaymentClaimStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";

export const PAYMENT_CLAIM_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Paid",
] as const satisfies readonly PaymentClaimStatus[];

export const OPEN_CLAIM_STATUSES: readonly PaymentClaimStatus[] = ["Draft", "Submitted", "Approved"];

export interface PaymentClaim {
  id: string;
  projectId: string;
  milestonePaymentId: string | null;
  claimNumber: string;
  periodStart: string | null;
  periodEnd: string | null;
  amount: number;
  status: PaymentClaimStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  // Stored at approval so the invoice never drifts from the terms it was
  // certified under. Null until the claim is approved.
  retentionAmount: number | null;
  advanceRecoveryAmount: number | null;
  vatAmount: number | null;
  whtAmount: number | null;
  invoiceAmount: number | null;
  invoiceNumber: string | null;
  invoiceRecordedAt: string | null;
  invoiceRecordedBy: string | null;
  createdAt: string;
}

export interface PaymentClaimRow {
  id: string;
  project_id: string;
  milestone_payment_id: string | null;
  claim_number: string;
  period_start: string | null;
  period_end: string | null;
  amount: string;
  status: PaymentClaimStatus;
  submitted_at: string | null;
  approved_at: string | null;
  notes: string | null;
  retention_amount: string | null;
  advance_recovery_amount: string | null;
  vat_amount: string | null;
  wht_amount: string | null;
  invoice_amount: string | null;
  invoice_number: string | null;
  invoice_recorded_at: Date | string | null;
  invoice_recorded_by: string | null;
  created_at: Date | string;
}

export interface RecordInvoiceInput {
  invoiceNumber: string;
}
