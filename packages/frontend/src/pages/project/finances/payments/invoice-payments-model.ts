import type {
  Invoice,
  InvoicePaymentsResponse,
  InvoicePaymentsRow,
  InvoicePaymentsTotals,
} from "@/hooks/use-invoices";
import { Money } from "@/lib/money";

/**
 * Shapes the Payments tab. The tab prefers `GET /invoices/payments`; until
 * that endpoint is live it derives the same rows from the invoice list, which
 * already carries each invoice's payments.
 */

export function rowsFromInvoices(invoices: Invoice[]): InvoicePaymentsRow[] {
  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    vendorName: invoice.vendorName,
    invoiceType: invoice.invoiceType,
    status: invoice.status,
    currency: invoice.currency,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    budgetMonth: invoice.budgetMonth ?? null,
    netPayable: invoice.netPayable,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    payments: invoice.payments,
  }));
}

export function totalsOf(rows: InvoicePaymentsRow[]): InvoicePaymentsTotals {
  return {
    invoiced: Money.sum(rows.map((row) => row.netPayable)).round(2).toNumber(),
    paid: Money.sum(rows.map((row) => row.amountPaid)).round(2).toNumber(),
    outstanding: Money.sum(rows.map((row) => row.balanceDue)).round(2).toNumber(),
  };
}

/** Accepts the endpoint's shape, a bare array, or nothing (→ derived from the list). */
export function normalisePayments(
  data: InvoicePaymentsResponse | InvoicePaymentsRow[] | undefined,
  invoices: Invoice[],
): InvoicePaymentsResponse {
  if (Array.isArray(data)) return { invoices: data, totals: totalsOf(data) };
  if (data && Array.isArray(data.invoices)) {
    return { invoices: data.invoices, totals: data.totals ?? totalsOf(data.invoices) };
  }
  const rows = rowsFromInvoices(invoices);
  return { invoices: rows, totals: totalsOf(rows) };
}

export function filterPaymentRows(rows: InvoicePaymentsRow[], search: string): InvoicePaymentsRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    [row.number, row.vendorName].filter(Boolean).join(" ").toLowerCase().includes(query),
  );
}

/**
 * Which parent rows start open: the first one by default, every one while a
 * search or filter is applied (so a match is never hidden inside a fold).
 */
export function defaultExpanded(rows: InvoicePaymentsRow[], isFiltered: boolean): Set<string> {
  if (isFiltered) return new Set(rows.map((row) => row.id));
  const first = rows[0];
  return first ? new Set([first.id]) : new Set();
}
