export type InvoiceStatus = "Draft" | "Submitted" | "Approved" | "Paid";
export type PaymentMethod = "Bank Transfer" | "Cash" | "Card" | "Cheque" | "Other";

export interface InvoicePayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string | null;
  note: string | null;
}

export interface Invoice {
  id: string;
  vendorName: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  amount: number;
  retainagePercentage: number;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  retainageAmount: number;
  payableAmount: number;
  amountPaid: number;
  balanceDue: number;
  payments: InvoicePayment[];
}

export interface InvoiceRow {
  id: string;
  project_id: string;
  vendor_name: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  amount: string;
  retainage_percentage: string;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
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
