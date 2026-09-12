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

/** Hands the PDF blob to the browser as a download named after the invoice. */
export function saveInvoicePdf(blob: Blob, invoice: Pick<Invoice, "number" | "id">): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `invoice-${invoice.number || invoice.id}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
