import api from "./client";

export type InvoiceStatus = "Draft" | "Sent" | "Approved" | "PartiallyPaid" | "Paid" | "Overdue";
export type InvoiceType = "progress" | "final" | "variation" | "vendor" | "material";

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
    
  addPayment: (projectId: string, invoiceId: string, body: PaymentInput) =>
    api.post<InvoicePayment>(`/projects/${projectId}/invoices/${invoiceId}/payments`, body).then(r => r.data),
    
  deletePayment: (projectId: string, invoiceId: string, paymentId: string) =>
    api.delete(`/projects/${projectId}/invoices/${invoiceId}/payments/${paymentId}`).then(r => r.data),
    
  send: (projectId: string, invoiceId: string, body: SendInvoiceInput) =>
    api.post<{ success: boolean }>(`/projects/${projectId}/invoices/${invoiceId}/send`, body).then(r => r.data),

  pdf: (projectId: string, invoiceId: string) =>
    api.get(`/projects/${projectId}/invoices/${invoiceId}/pdf`, { responseType: "blob" }).then(r => r.data),
    
  getAllocations: (projectId: string, invoiceId: string) =>
    api.get<{ allocations: InvoiceAllocation[] }>(`/projects/${projectId}/invoices/${invoiceId}/allocations`).then(r => r.data.allocations),
    
  setAllocations: (projectId: string, invoiceId: string, allocations: { budgetCategoryId: string; amount: number }[]) =>
    api.put<{ allocations: InvoiceAllocation[] }>(`/projects/${projectId}/invoices/${invoiceId}/allocations`, { allocations }).then(r => r.data.allocations),

  scan: (projectId: string, fileId: string) =>
    api.post<InvoiceScanResult>(`/projects/${projectId}/invoices/scan`, { fileId }).then(r => r.data),
};

export type InvoiceDocumentKind = "invoice" | "receipt" | "quote" | "other";
export type InvoiceScanConfidence = "high" | "medium" | "low";

export interface ExtractedInvoiceParty {
  name: string | null;
  address: string | null;
  tin: string | null;
  firsNumber: string | null;
  email: string | null;
  bank: { accountName: string | null; accountNumber: string | null; bankName: string | null } | null;
}

export interface ExtractedInvoiceLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitRate: number | null;
  lineTotal: number | null;
}

export interface ExtractedInvoice {
  documentKind: InvoiceDocumentKind;
  confidence: InvoiceScanConfidence;
  vendorName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  lineItems: ExtractedInvoiceLineItem[];
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  whtRate: number | null;
  retentionRate: number | null;
  total: number | null;
  fromParty: ExtractedInvoiceParty | null;
  toParty: ExtractedInvoiceParty | null;
  notes: string | null;
}

export interface InvoiceScanResult {
  draft: ExtractedInvoice;
  sourceFileId: string;
  retryCount: number;
}


export interface InvoiceAllocation {
  id: string;
  invoiceId: string;
  budgetCategoryId: string;
  amount: number;
}
