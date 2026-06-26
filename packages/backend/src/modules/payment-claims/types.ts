export type PaymentClaimStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";

export const PAYMENT_CLAIM_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Paid",
] as const satisfies readonly PaymentClaimStatus[];

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
  created_at: Date | string;
}
