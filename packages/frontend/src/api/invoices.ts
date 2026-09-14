import type { InvoiceScanResult } from "./invoice-scan-types";
import api from "./client";

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Submitted"
  | "Queried"
  | "Approved"
  | "PartiallyPaid"
  | "Paid"
  | "Overdue"
  | "Void";
/** The mobilisation advance is its own certificate; recovery comes off later ones. */
export type InvoiceType = "progress" | "final" | "variation" | "vendor" | "material" | "advance";

/**
 * Which way the certificate points. `receivable` is what WE certify to the
 * employer (progress, final, variation, advance) and is the only direction
 * that feeds the contract waterfall; `payable` is what a vendor bills us.
 */
export type InvoiceDirection = "payable" | "receivable";

export type InvoiceEventType =
  | "created"
  | "sent"
  | "queried"
  | "approved"
  | "voided"
  | "payment_recorded"
  | "payment_removed";

/** One status change on the certificate: who, when, and why. */
export interface InvoiceEvent {
  id: string;
  type: InvoiceEventType;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actor: { id: string | null; name: string };
  amount: number | null;
  createdAt: string;
}

/**
 * The interim-certificate structure a QS reads down: what was certified
 * before, what this certificate adds, and where that leaves the cumulative
 * position — with the deductions this certificate takes.
 */
export interface InvoiceCertificate {
  /** 1 for IPC 1, 2 for IPC 2 …, counted over receivable progress certificates. */
  number: number;
  previousCertified: number;
  thisCertificate: number;
  cumulative: number;
  retention: number;
  vat: number;
  advanceRecovery: number;
  netPayable: number;
}

export type PaymentMethod =
  | "Bank Transfer"
  | "Cash"
  | "Card"
  | "Cheque"
  | "Other";

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string | null;
  note: string | null;
  /** An accepted overpayment, recorded as a credit rather than a receipt. */
  credit?: boolean;
}

export interface InvoiceLineItem {
  id: string;
  position: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitRate: number;
  amount: number;
  budgetCategoryId: string | null;
  isVariation: boolean;
}

export interface InvoiceParty {
  name: string | null;
  address: string | null;
  tin: string | null;
  firsNumber: string | null;
  email: string | null;
  bank: {
    accountName: string | null;
    accountNumber: string | null;
    bankName: string | null;
  } | null;
}

export interface Invoice {
  id: string;
  invoiceType: InvoiceType;
  currency: string;
  vendorName: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  whtRate: number;
  whtAmount: number;
  retentionRate: number;
  retentionAmount: number;
  totalInvoiced: number;
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePayment[];
  fromParty: InvoiceParty | null;
  toParty: InvoiceParty | null;
  recipientEmail: string | null;
  ccEmails: string[] | null;
  bccEmails: string[] | null;
  poReferenceId: string | null;
  paymentClaimId: string | null;
  milestonePaymentId: string | null;
  contractReference: string | null;
  paymentTerms: string | null;
  paymentInstructions: string | null;
  coverNote: string | null;
  headerText: string | null;
  footerText: string | null;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  sentAt: string | null;
  publicToken: string | null;
  viewedAt: string | null;
  /** Billing-sheet month (YYYY-MM) a progress invoice bills; null for the other types. */
  budgetMonth?: string | null;
  /** Statuses this invoice may move to next; the inline status select offers only these. */
  nextStatuses?: InvoiceStatus[];
  /** Which way the certificate points; a client invoice is receivable. */
  direction?: InvoiceDirection;
  /** The party on the other side of the certificate, whichever way it points. */
  counterparty?: string | null;
  /** The contract this certificate bills against; the main contract by default. */
  contractId?: string | null;
  advanceRecovery?: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  /** Days between the due date and the recorded receipt, when it was late. */
  paidLateDays?: number | null;
  /** Days past due on an unpaid certificate. */
  overdueDays?: number | null;
  /** Every status change, with actor and reason. Empty until the History tab loads it. */
  history?: InvoiceEvent[];
}

/** One invoice with its recorded payments, as `GET /invoices/payments` lists them. */
export interface InvoicePaymentsRow {
  id: string;
  number: string | null;
  vendorName: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  workflowStatus?: InvoiceStatus;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  budgetMonth: string | null;
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePayment[];
  direction?: InvoiceDirection;
  counterparty?: string | null;
  voidedAt?: string | null;
  paidLateDays?: number | null;
  overdueDays?: number | null;
}

export interface InvoicePaymentsTotals {
  invoiced: number;
  paid: number;
  outstanding: number;
}

export interface InvoicePaymentsResponse {
  invoices: InvoicePaymentsRow[];
  totals: InvoicePaymentsTotals;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity?: number;
  unit?: string;
  unitRate?: number;
  budgetCategoryId?: string;
  isVariation?: boolean;
}

export interface InvoiceInput {
  direction?: InvoiceDirection;
  counterparty?: string | null;
  contractId?: string | null;
  vendorName: string;
  trade: string;
  number?: string;
  status?: InvoiceStatus;
  amount?: number;
  retainagePercentage?: number;
  invoiceType?: InvoiceType;
  currency?: string;
  vatRate?: number;
  whtRate?: number;
  retentionRate?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  fromParty?: InvoiceParty | null;
  toParty?: InvoiceParty | null;
  recipientEmail?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  poReferenceId?: string;
  paymentClaimId?: string;
  milestonePaymentId?: string;
  contractReference?: string;
  paymentTerms?: string;
  paymentInstructions?: string;
  coverNote?: string;
  headerText?: string;
  footerText?: string;
  sourceFileId?: string;
  lineItems?: InvoiceLineItemInput[];
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  paidAt?: string;
  note?: string;
  /** Accept a payment above the balance; it is recorded as a credit, with a note. */
  allowOverpayment?: boolean;
}

export interface SendInvoiceInput {
  recipientEmail: string;
  cc?: string[];
  bcc?: string[];
  coverNote?: string;
  headerText?: string;
  footerText?: string;
}

export const invoicesApi = {
  list: (projectId: string) => 
    api.get<Invoice[]>(`/projects/${projectId}/invoices`).then(r => r.data),
  
  detail: (projectId: string, invoiceId: string) => 
    api.get<Invoice>(`/projects/${projectId}/invoices/${invoiceId}`).then(r => r.data),
    
  create: (projectId: string, body: InvoiceInput) =>
    api.post<Invoice>(`/projects/${projectId}/invoices`, body).then(r => r.data),
    
  update: (projectId: string, invoiceId: string, patch: InvoiceInput) =>
    api.put<Invoice>(`/projects/${projectId}/invoices/${invoiceId}`, patch).then(r => r.data),
    
  delete: (projectId: string, invoiceId: string) =>
    api.delete(`/projects/${projectId}/invoices/${invoiceId}`).then(r => r.data),
    
  /** Every invoice with its payments, for the Payments tab. */
  payments: (projectId: string) =>
    api.get<InvoicePaymentsResponse>(`/projects/${projectId}/invoices/payments`).then(r => r.data),

  /** Records a payment (finances:approve); the response is the invoice with its balances recomputed. */
  addPayment: (projectId: string, invoiceId: string, body: PaymentInput) =>
    api.post<Invoice>(`/projects/${projectId}/invoices/${invoiceId}/payments`, body).then(r => r.data),
    
  deletePayment: (projectId: string, invoiceId: string, paymentId: string) =>
    api.delete(`/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`).then(r => r.data),
    
  send: (projectId: string, invoiceId: string, body: SendInvoiceInput) =>
    api.post<{ success: boolean }>(`/projects/${projectId}/invoices/${invoiceId}/send`, body).then(r => r.data),

  pdf: (projectId: string, invoiceId: string) =>
    api.get(`/projects/${projectId}/invoices/${invoiceId}/pdf`, { responseType: "blob" }).then(r => r.data),
    
  getAllocations: (projectId: string, invoiceId: string) =>
    api.get<InvoiceAllocation[]>(`/projects/${projectId}/invoices/${invoiceId}/allocations`).then(r => r.data),
    
  setAllocations: (projectId: string, invoiceId: string, allocations: { budgetCategoryId: string; amount: number }[]) =>
    api.put<InvoiceAllocation[]>(`/projects/${projectId}/invoices/${invoiceId}/allocations`, { allocations }).then(r => r.data),

  scan: (projectId: string, fileId: string) =>
    api.post<InvoiceScanResult>(`/projects/${projectId}/invoices/scan`, { fileId }).then(r => r.data),

  /** `period` seeds an application that has no lines yet from the billing sheet's month. */
  payApplication: (projectId: string, invoiceId: string, period?: string) =>
    api.get<PayApplicationSummary>(`/projects/${projectId}/invoices/${invoiceId}/pay-application`, { params: period ? { period } : undefined }).then(r => r.data),

  /** `period` flags that billing-sheet month as invoiced on the stages saved. */
  setPayApplication: (projectId: string, invoiceId: string, lines: PayApplicationLineInput[], period?: string) =>
    api.put<PayApplicationSummary>(`/projects/${projectId}/invoices/${invoiceId}/pay-application`, { lines, period }).then(r => r.data),

  /** Previous / this / cumulative, with retention, VAT and advance recovery from the contract terms. */
  certificate: (projectId: string, invoiceId: string) =>
    api
      .get<InvoiceCertificate | null>(`/projects/${projectId}/invoices/${invoiceId}/certificate`)
      .then(r => r.data),

  /** Every status change on the certificate, with actor and reason. */
  history: (projectId: string, invoiceId: string) =>
    api.get<InvoiceEvent[]>(`/projects/${projectId}/invoices/${invoiceId}/history`).then(r => r.data),

  /** A paid certificate is an accounting record: it is voided with a reason, never deleted. */
  void: (projectId: string, invoiceId: string, reason: string) =>
    api.post<Invoice>(`/projects/${projectId}/invoices/${invoiceId}/void`, { reason }).then(r => r.data),

  /** A client query is a formal dispute: it always carries a reason. */
  query: (projectId: string, invoiceId: string, reason: string) =>
    api.post<Invoice>(`/projects/${projectId}/invoices/${invoiceId}/query`, { reason }).then(r => r.data),
};

export interface InvoiceAllocation {
  budgetCategoryId: string;
  amount: number;
}

export interface PayApplicationLine {
  stageId: string;
  stageName: string;
  scheduledValue: number;
  priorBilled: number;
  thisPeriod: number;
  storedMaterials: number;
  totalCompleted: number;
  percentComplete: number;
  balanceToFinish: number;
  retained: number;
  currentPaymentDue: number;
}

export interface PayApplicationSummary {
  lines: PayApplicationLine[];
  scheduledTotal: number;
  priorBilledTotal: number;
  thisPeriodTotal: number;
  storedMaterialsTotal: number;
  totalCompleted: number;
  balanceToFinish: number;
  retainedTotal: number;
  currentPaymentDue: number;
}

export interface PayApplicationLineInput {
  stageId: string;
  thisPeriod: number;
  storedMaterials?: number;
  retained?: number;
}
