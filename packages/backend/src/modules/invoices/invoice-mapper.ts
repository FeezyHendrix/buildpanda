import { Money } from "../../lib/money.ts";
import { nextInvoiceStatuses, toWorkflowStatus } from "./invoice-status.ts";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceLineItemRow,
  InvoicePayment,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
} from "./types.ts";

export function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}

export function toPayment(row: InvoicePaymentRow): InvoicePayment {
  return {
    id: row.id,
    amount: num(row.amount),
    method: row.method,
    paidAt: row.paid_at,
    note: row.note,
  };
}

export function toLineItem(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    position: row.position,
    description: row.description,
    quantity: num(row.quantity),
    unit: row.unit,
    unitRate: num(row.unit_rate),
    amount: num(row.amount),
    budgetCategoryId: row.budget_category_id,
    isVariation: row.is_variation,
  };
}

// Payment state is derived from what has been recorded against the invoice,
// never stored: a fully paid invoice reads Paid whatever its workflow status.
function deriveStatus(
  row: InvoiceRow,
  amountPaid: number,
  balanceDue: number,
  netPayable: number,
): InvoiceStatus {
  const workflowStatus = toWorkflowStatus(row.status);
  if (balanceDue <= 0 && netPayable > 0) return "Paid";
  if (amountPaid > 0) return "PartiallyPaid";
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  if (dueDate && dueDate < new Date() && balanceDue > 0 && workflowStatus !== "Draft") return "Overdue";
  return workflowStatus === "Submitted" ? "Sent" : workflowStatus;
}

/** The single row → DTO mapper for an invoice with its payments and lines. */
export function toInvoice(
  row: InvoiceRow,
  paymentRows: InvoicePaymentRow[],
  lineItemRows: InvoiceLineItemRow[],
): Invoice {
  const amount = num(row.amount);
  const retainagePercentage = num(row.retainage_percentage);
  const retainageAmount = Money.of(amount).percent(retainagePercentage).round(2).toNumber();
  const payableAmount = Money.of(amount).sub(retainageAmount).round(2).toNumber();
  const payments = paymentRows.map(toPayment);
  const amountPaid = Money.sum(payments.map((p) => p.amount)).round(2).toNumber();
  const netPayable = num(row.net_payable);
  const balanceDue = Money.of(netPayable).sub(amountPaid).round(2).toNumber();
  const workflowStatus = toWorkflowStatus(row.status);

  return {
    id: row.id,
    invoiceType: row.invoice_type,
    vendorName: row.vendor_name,
    trade: row.trade,
    number: row.number,
    status: deriveStatus(row, amountPaid, balanceDue, netPayable),
    workflowStatus,
    nextStatuses: nextInvoiceStatuses(workflowStatus),
    budgetMonth: row.billing_period ?? null,
    currency: row.currency,
    amount,
    retainagePercentage,
    vatRate: num(row.vat_rate),
    whtRate: num(row.wht_rate),
    retentionRate: num(row.retention_rate),
    subtotal: num(row.subtotal),
    vatAmount: num(row.vat_amount),
    whtAmount: num(row.wht_amount),
    retentionAmount: num(row.retention_amount),
    totalInvoiced: num(row.total_invoiced),
    netPayable,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes,
    fromParty: row.from_party,
    toParty: row.to_party,
    recipientEmail: row.recipient_email,
    ccEmails: row.cc_emails ?? [],
    bccEmails: row.bcc_emails ?? [],
    poReferenceId: row.po_reference_id,
    paymentClaimId: row.payment_claim_id,
    milestonePaymentId: row.milestone_payment_id,
    contractReference: row.contract_reference,
    paymentTerms: row.payment_terms,
    paymentInstructions: row.payment_instructions,
    coverNote: row.cover_note,
    headerText: row.header_text,
    footerText: row.footer_text,
    sentAt: row.sent_at,
    sentTo: row.sent_to,
    publicToken: row.public_token,
    viewedAt: row.viewed_at,
    pdfStorageKey: row.pdf_storage_key,
    retainageAmount,
    payableAmount,
    amountPaid,
    balanceDue,
    lineItems: lineItemRows.map(toLineItem),
    payments,
  };
}
