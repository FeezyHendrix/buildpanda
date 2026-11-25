import type { Invoice, InvoiceStatus } from "@/hooks/use-invoices";
import { formatPeriodHeading } from "../contract/billing-sheet-model";

/**
 * Pure helpers for the invoice table and drawer. Statuses are recorded
 * positions — moving one logs where the invoice stands, it never charges.
 */

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "Draft",
  "Sent",
  "Submitted",
  "Queried",
  "Approved",
  "PartiallyPaid",
  "Paid",
  "Overdue",
  "Void",
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  Draft: "Draft",
  Sent: "Sent",
  Submitted: "Submitted",
  Queried: "Queried",
  Approved: "Approved",
  PartiallyPaid: "Partially paid",
  Paid: "Paid",
  Overdue: "Overdue",
  Void: "Void",
};

/**
 * Where an invoice may move when the backend has not said (`nextStatuses`
 * missing). The workflow statuses are the ones a person sets — Draft → Sent →
 * Submitted → Queried/Approved; paid, partially paid and overdue are read
 * from the payments and dates, never chosen.
 */
const FALLBACK_NEXT: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  Draft: ["Sent", "Submitted"],
  Sent: ["Submitted", "Approved"],
  Submitted: ["Queried", "Approved"],
  Queried: ["Submitted", "Approved"],
  Approved: [],
  PartiallyPaid: [],
  Overdue: ["Approved"],
  Paid: [],
  Void: [],
};

export function nextInvoiceStatuses(invoice: Invoice): readonly InvoiceStatus[] {
  return invoice.nextStatuses ?? FALLBACK_NEXT[invoice.status];
}

export type InvoiceStatusFilter = InvoiceStatus | "all";

export const INVOICE_STATUS_FILTERS: readonly { value: InvoiceStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...INVOICE_STATUSES.map((status) => ({ value: status, label: INVOICE_STATUS_LABEL[status] })),
];

export function invoiceLabel(invoice: Pick<Invoice, "number" | "vendorName">): string {
  return invoice.number ? `${invoice.vendorName} · ${invoice.number}` : invoice.vendorName;
}

/** The billing-sheet month a progress invoice bills, or a dash. */
export function budgetMonthLabel(invoice: Invoice): string {
  return invoice.budgetMonth ? formatPeriodHeading(invoice.budgetMonth) : "—";
}

/** "3 Mar 2026 – 2 Apr 2026", or whichever end is known. */
export function invoicePeriodLabel(invoice: Invoice): string {
  const from = invoice.issueDate ? formatDay(invoice.issueDate) : null;
  const to = invoice.dueDate ? formatDay(invoice.dueDate) : null;
  if (from && to) return `${from} – ${to}`;
  return from ?? to ?? "—";
}

function formatDay(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function matchesInvoiceSearch(invoice: Invoice, query: string): boolean {
  if (!query) return true;
  const haystack = [invoice.number, invoice.vendorName, invoice.trade, invoice.contractReference]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function filterInvoices(
  invoices: Invoice[],
  status: InvoiceStatusFilter,
  search: string,
): Invoice[] {
  const query = search.trim().toLowerCase();
  return invoices.filter(
    (invoice) => (status === "all" || invoice.status === status) && matchesInvoiceSearch(invoice, query),
  );
}

/**
 * How the other party is named. A certificate we raise to the employer is
 * RECEIVABLE — the party on it is the client, never a "vendor"; a bill a
 * supplier sends us is PAYABLE and its party really is the vendor.
 */
export function counterpartyLabel(invoice: Pick<Invoice, "direction">): string {
  return invoice.direction === "payable" ? "Vendor" : "Client";
}

export function counterpartyName(
  invoice: Pick<Invoice, "counterparty" | "vendorName">,
): string {
  return invoice.counterparty ?? invoice.vendorName;
}

/** A voided certificate stays on file with its receipts; its figures are reversed. */
export function isVoided(invoice: Pick<Invoice, "voidedAt" | "status">): boolean {
  return Boolean(invoice.voidedAt) || invoice.status === "Void";
}

/** A payment may only be recorded against a certified (Approved+) invoice. */
export function canRecordPaymentOn(
  invoice: Pick<Invoice, "status" | "voidedAt">,
): { allowed: boolean; reason: string | null } {
  if (isVoided(invoice)) {
    return { allowed: false, reason: "This certificate was voided — record the payment on its replacement." };
  }
  if (invoice.status === "Approved" || invoice.status === "PartiallyPaid" || invoice.status === "Paid") {
    return { allowed: true, reason: null };
  }
  return {
    allowed: false,
    reason:
      invoice.status === "Draft"
        ? "This invoice has not been issued — send and certify it before recording a payment."
        : `This invoice is ${INVOICE_STATUS_LABEL[invoice.status]} — it must be approved before a payment is recorded against it.`,
  };
}

/** Hands the PDF blob to the browser as a download named after the invoice. */
export function saveInvoicePdf(blob: Blob, invoice: Pick<Invoice, "number" | "id">): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `invoice-${invoice.number || invoice.id}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** The design calls a submitted invoice "Pending approval"; every other status reads as itself. */
export function invoiceStatusLabel(status: InvoiceStatus): string {
  return status === "Submitted" ? "Pending approval" : INVOICE_STATUS_LABEL[status];
}

/** Status as a pill: the label carries the meaning, the colour only reinforces it. */
export const INVOICE_PILL: Record<InvoiceStatus, string> = {
  Draft: "border-[#E0E0E0] bg-white text-[#1E1E1E]",
  Sent: "border-[#C6D6FA] bg-white text-[#004DE7]",
  Submitted: "border-[#FFD8A8] bg-[#FFF8EB] text-[#E58A00]",
  Queried: "border-[#FFC9C9] bg-[#FFF3E8] text-[#D9480F]",
  Approved: "border-[#B9F8CF] bg-[#F0FDF4] text-[#00A63E]",
  PartiallyPaid: "border-[#C6D6FA] bg-[#E6EDFD] text-[#004DE7]",
  Paid: "border-[#C6D6FA] bg-[#E6EDFD] text-[#004DE7]",
  Overdue: "border-[#FFC9C9] bg-[#FEF2F2] text-[#E7000B]",
  Void: "border-[#E0E0E0] bg-[#F6F6F6] text-[#737373]",
};

export interface InvoiceKpis {
  outstanding: { total: number; count: number };
  pending: { total: number; count: number };
  overdue: { total: number; count: number };
  paidThisMonth: { total: number; count: number };
}

/**
 * The four headline figures, all derived from the recorded invoices. Outstanding
 * is what is still owed on issued, un-voided invoices; paid this month is the
 * receipts dated in the current calendar month.
 */
export function invoiceKpis(invoices: readonly Invoice[], now = new Date()): InvoiceKpis {
  const live = invoices.filter((invoice) => !isVoided(invoice));
  const sum = (list: readonly Invoice[], pick: (invoice: Invoice) => number) => list.reduce((total, invoice) => total + pick(invoice), 0);

  const outstanding = live.filter((invoice) => invoice.status !== "Draft" && invoice.balanceDue > 0);
  const pending = live.filter((invoice) => invoice.status === "Submitted");
  const overdue = live.filter((invoice) => invoice.status === "Overdue");

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let paidTotal = 0;
  let paidCount = 0;
  for (const invoice of live) {
    const inMonth = invoice.payments.filter((payment) => !payment.credit && payment.paidAt?.slice(0, 7) === monthKey);
    if (inMonth.length === 0) continue;
    paidCount += 1;
    paidTotal += inMonth.reduce((total, payment) => total + payment.amount, 0);
  }

  return {
    outstanding: { total: sum(outstanding, (i) => i.balanceDue), count: outstanding.length },
    pending: { total: sum(pending, (i) => i.totalInvoiced), count: pending.length },
    overdue: { total: sum(overdue, (i) => i.balanceDue), count: overdue.length },
    paidThisMonth: { total: paidTotal, count: paidCount },
  };
}
