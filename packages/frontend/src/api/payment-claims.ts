import api from "./client";

export type PaymentClaimStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";

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
  // Fixed at approval: what comes off the certified sum and what the invoice
  // reads. Null until approved.
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

export interface PaymentClaimInput {
  milestonePaymentId?: string | null;
  claimNumber: string;
  periodStart?: string;
  periodEnd?: string;
  amount: number;
  status: PaymentClaimStatus;
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export const paymentClaimsApi = {
  list: (projectId: string) =>
    api.get<PaymentClaim[]>(`/projects/${projectId}/payment-claims`).then(r => r.data),

  create: (projectId: string, body: PaymentClaimInput) =>
    api.post<PaymentClaim>(`/projects/${projectId}/payment-claims`, body).then(r => r.data),

  update: (projectId: string, claimId: string, patch: PaymentClaimInput) =>
    api.put<PaymentClaim>(`/projects/${projectId}/payment-claims/${claimId}`, patch).then(r => r.data),

  delete: (projectId: string, claimId: string) =>
    api.delete(`/projects/${projectId}/payment-claims/${claimId}`).then(r => r.data),

  // Records the invoice raised for an approved claim. A log entry, not a charge.
  recordInvoice: (projectId: string, claimId: string, invoiceNumber: string) =>
    api
      .post<PaymentClaim>(`/projects/${projectId}/payment-claims/${claimId}/record-invoice`, { invoiceNumber })
      .then(r => r.data),
};
