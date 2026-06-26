export const INVOICE_TYPES = ["progress", "final", "variation", "vendor", "material"] as const;
export const INVOICE_STATUSES = ["Draft", "Sent", "Approved", "PartiallyPaid", "Paid", "Overdue"] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type StoredInvoiceStatus = "Draft" | "Sent" | "Approved" | "Submitted";
export type PaymentMethod = "Bank Transfer" | "Cash" | "Card" | "Cheque" | "Other";

export interface InvoicePartyBank {
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
}

export interface InvoiceParty {
  name: string | null;
  address: string | null;
  tin: string | null;
  firsNumber: string | null;
  email: string | null;
  bank: InvoicePartyBank;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string | null;
  note: string | null;
}

export interface InvoiceBudgetAllocation {
  budgetCategoryId: string;
  amount: number;
}

export interface InvoiceLineItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string | null;
  unitRate: number;
  amount: number;
  budgetCategoryId: string | null;
  isVariation: boolean;
}

export interface Invoice {
  id: string;
  invoiceType: InvoiceType;
  vendorName: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  workflowStatus: StoredInvoiceStatus;
  currency: string;
  amount: number;
  retainagePercentage: number;
  vatRate: number;
  whtRate: number;
  retentionRate: number;
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  retentionAmount: number;
  totalInvoiced: number;
  netPayable: number;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  fromParty: InvoiceParty | null;
  toParty: InvoiceParty | null;
  recipientEmail: string | null;
  ccEmails: string[];
  bccEmails: string[];
  poReferenceId: string | null;
  paymentClaimId: string | null;
  milestonePaymentId: string | null;
  contractReference: string | null;
  paymentTerms: string | null;
  coverNote: string | null;
  headerText: string | null;
  footerText: string | null;
  sentAt: string | null;
  sentTo: unknown | null;
  publicToken: string | null;
  viewedAt: string | null;
  pdfStorageKey: string | null;
  retainageAmount: number;
  payableAmount: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

export interface InvoiceRow {
  id: string;
  project_id: string;
  invoice_type: InvoiceType;
  vendor_name: string;
  trade: string;
  number: string | null;
  status: StoredInvoiceStatus | InvoiceStatus;
  currency: string;
  amount: string;
  retainage_percentage: string;
  vat_rate: string | null;
  wht_rate: string | null;
  retention_rate: string | null;
  subtotal: string;
  vat_amount: string;
  wht_amount: string;
  retention_amount: string;
  total_invoiced: string;
  net_payable: string;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  from_party: InvoiceParty | null;
  to_party: InvoiceParty | null;
  recipient_email: string | null;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  po_reference_id: string | null;
  payment_claim_id: string | null;
  milestone_payment_id: string | null;
  contract_reference: string | null;
  payment_terms: string | null;
  cover_note: string | null;
  header_text: string | null;
  footer_text: string | null;
  sent_at: string | null;
  sent_to: unknown | null;
  public_token: string | null;
  viewed_at: string | null;
  pdf_storage_key: string | null;
  created_at: Date | string;
}

export interface InvoiceLineItemRow {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: string;
  unit: string | null;
  unit_rate: string;
  amount: string;
  budget_category_id: string | null;
  is_variation: boolean;
  created_at: Date | string;
}

export interface InvoicePaymentRow {
  id: string;
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  paid_at: string | null;
  note: string | null;
  created_at: Date | string;
}
