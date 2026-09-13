import { Money } from "../../lib/money.ts";
import { nextInvoiceStatuses, toWorkflowStatus } from "./invoice-status.ts";
import type {
  Invoice,
  InvoiceEvent,
  InvoiceEventRow,
  InvoiceLineItem,
  InvoiceLineItemRow,
  InvoicePayment,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
} from "./types.ts";

const DAY_MS = 86_400_000;

function dayDiff(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const start = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / DAY_MS);
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toInvoiceEvent(row: InvoiceEventRow): InvoiceEvent {
  return {
    id: row.id,
    type: row.type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    actor: { id: row.actor_id, name: row.actor_name },
    amount: row.amount === null ? null : num(row.amount),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

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
    credit: Boolean(row.credit),
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
  // A voided certificate keeps every figure on the record but contributes
  // nothing — that is the whole point of voiding instead of deleting.
  if (row.voided_at) return "Void";
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
  eventRows: InvoiceEventRow[] = [],
  today = new Date().toISOString().slice(0, 10),
): Invoice {
  const amount = num(row.amount);
  const retainagePercentage = num(row.retainage_percentage);
  const retainageAmount = Money.of(amount).percent(retainagePercentage).round(2).toNumber();
  const payableAmount = Money.of(amount).sub(retainageAmount).round(2).toNumber();
  const payments = paymentRows.map(toPayment);
  // A credit is an accepted overpayment, not a receipt against the balance.
  const amountPaid = Money.sum(payments.filter((p) => !p.credit).map((p) => p.amount))
    .round(2)
    .toNumber();
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
    direction: row.direction ?? "payable",
    counterparty: row.counterparty ?? row.vendor_name,
    contractId: row.contract_id ?? null,
    advanceRecovery: num(row.advance_recovery),
    voidedAt: iso(row.voided_at),
    voidReason: row.void_reason ?? null,
    // Lateness is measured retrospectively from the LAST receipt that cleared
    // the certificate, so "paid 11 days late" survives after the fact.
    paidLateDays: lastPaymentLateDays(row, payments, balanceDue),
    overdueDays: unpaidOverdueDays(row, balanceDue, today),
    lineItems: lineItemRows.map(toLineItem),
    payments,
    history: eventRows.map(toInvoiceEvent),
  };
}

/** Days late on a certificate that HAS been cleared; null while it is unpaid. */
function lastPaymentLateDays(
  row: InvoiceRow,
  payments: InvoicePayment[],
  balanceDue: number,
): number | null {
  if (balanceDue > 0 || !row.due_date) return null;
  const dates = payments.filter((p) => !p.credit && p.paidAt).map((p) => String(p.paidAt));
  if (dates.length === 0) return null;
  const settled = dates.sort().at(-1) ?? null;
  const late = dayDiff(row.due_date, settled);
  return late !== null && late > 0 ? late : null;
}

/** Days past due on a certificate still carrying a balance. */
function unpaidOverdueDays(row: InvoiceRow, balanceDue: number, today: string): number | null {
  if (balanceDue <= 0 || !row.due_date || row.voided_at) return null;
  if (toWorkflowStatus(row.status) === "Draft") return null;
  const overdue = dayDiff(row.due_date, today);
  return overdue !== null && overdue > 0 ? overdue : null;
}
