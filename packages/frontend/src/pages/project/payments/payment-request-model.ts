import type { PaymentClaim, PaymentClaimInput, PaymentClaimStatus } from "@/hooks/use-payment-claims";

/**
 * Form model + status metadata for payment requests. "Payment request" is the
 * user-facing term; the underlying PaymentClaim* API/enum names are unchanged.
 */
export interface RequestValues {
  milestonePaymentId: string;
  claimNumber: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  status: PaymentClaimStatus;
  submittedAt: string;
  approvedAt: string;
  notes: string;
}

export const STATUSES: PaymentClaimStatus[] = ["Draft", "Submitted", "Approved", "Rejected", "Paid"];

export const STATUS_TONE: Record<PaymentClaimStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "success",
  Rejected: "danger",
  Paid: "success",
};

export const STATUS_SHAPE: Record<PaymentClaimStatus, string> = {
  Draft: "○",
  Submitted: "→",
  Approved: "✓",
  Rejected: "×",
  Paid: "●",
};

export const EMPTY: RequestValues = {
  milestonePaymentId: "",
  claimNumber: "",
  periodStart: "",
  periodEnd: "",
  amount: "",
  status: "Draft",
  submittedAt: "",
  approvedAt: "",
  notes: "",
};

export const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

export function toInput(values: RequestValues): PaymentClaimInput {
  return {
    milestonePaymentId: values.milestonePaymentId || null,
    claimNumber: values.claimNumber,
    periodStart: values.periodStart || undefined,
    periodEnd: values.periodEnd || undefined,
    amount: Number(values.amount),
    status: values.status,
    submittedAt: values.submittedAt || undefined,
    approvedAt: values.approvedAt || undefined,
    notes: values.notes || undefined,
  };
}

export function toValues(claim: PaymentClaim): RequestValues {
  return {
    milestonePaymentId: claim.milestonePaymentId ?? "",
    claimNumber: claim.claimNumber,
    periodStart: claim.periodStart ?? "",
    periodEnd: claim.periodEnd ?? "",
    amount: String(claim.amount),
    status: claim.status,
    submittedAt: claim.submittedAt ?? "",
    approvedAt: claim.approvedAt ?? "",
    notes: claim.notes ?? "",
  };
}
