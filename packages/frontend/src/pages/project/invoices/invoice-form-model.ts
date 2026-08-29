import { type InvoiceStatus, type InvoiceType, type ExtractedInvoice } from "@/hooks/use-invoices";
import { Money } from "@/lib/money";

export interface UpsertLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitRate: string;
}

export interface UpsertInvoiceValues {
  vendorName: string;
  trade: string;
  number: string;
  status: InvoiceStatus;
  invoiceType: InvoiceType;
  currency: string;
  vatRate: string;
  whtRate: string;
  retentionRate: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  paymentInstructions: string;
  recipientEmail: string;
  notes: string;
  lineItems: UpsertLineItem[];
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  wht: number;
  retention: number;
  totalInvoiced: number;
  netPayable: number;
}

export const STATUSES: InvoiceStatus[] = [
  "Draft",
  "Sent",
  "Approved",
  "PartiallyPaid",
  "Paid",
  "Overdue",
];

export const TYPES: { value: InvoiceType; label: string }[] = [
  { value: "vendor", label: "Vendor invoice" },
  { value: "progress", label: "Progress / IPC" },
  { value: "variation", label: "Variation" },
  { value: "final", label: "Final account" },
  { value: "material", label: "Material" },
];

export const inputClass =
  "h-11 w-full rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:bg-white transition-colors";

export function emptyLine(): UpsertLineItem {
  return { description: "", quantity: "1", unit: "", unitRate: "" };
}

export const EMPTY_INVOICE: UpsertInvoiceValues = {
  vendorName: "",
  trade: "",
  number: "",
  status: "Draft",
  invoiceType: "vendor",
  currency: "NGN",
  vatRate: "7.5",
  whtRate: "0",
  retentionRate: "0",
  issueDate: "",
  dueDate: "",
  paymentTerms: "",
  paymentInstructions: "",
  recipientEmail: "",
  notes: "",
  lineItems: [emptyLine()],
};

export function round2(n: number): number {
  return Money.of(n).round(2).toNumber();
}

export function lineAmount(line: UpsertLineItem): number {
  return Money.of(line.quantity || "0")
    .mul(line.unitRate || "0")
    .round(2)
    .toNumber();
}

export function computeTotals(values: UpsertInvoiceValues): InvoiceTotals {
  const subtotal = Money.sum(
    values.lineItems.map((li) =>
      Money.of(li.quantity || "0").mul(li.unitRate || "0"),
    ),
  ).round(2);
  const vat = subtotal.percent(values.vatRate || "0").round(2);
  const wht = subtotal.percent(values.whtRate || "0").round(2);
  const retention = subtotal.percent(values.retentionRate || "0").round(2);
  const totalInvoiced = subtotal.add(vat).round(2);
  const netPayable = totalInvoiced.sub(wht).sub(retention).round(2);
  return {
    subtotal: subtotal.toNumber(),
    vat: vat.toNumber(),
    wht: wht.toNumber(),
    retention: retention.toNumber(),
    totalInvoiced: totalInvoiced.toNumber(),
    netPayable: netPayable.toNumber(),
  };
}

export function countValidLines(values: UpsertInvoiceValues): number {
  return values.lineItems.filter(
    (li) => li.description.trim().length > 0 && Number(li.unitRate || "0") > 0,
  ).length;
}

export function isInvoiceValid(values: UpsertInvoiceValues): boolean {
  return values.vendorName.trim().length > 0 && countValidLines(values) > 0;
}

export function sanitizeInvoice(
  values: UpsertInvoiceValues,
): UpsertInvoiceValues {
  return {
    ...values,
    vendorName: values.vendorName.trim(),
    trade: values.trade.trim(),
    number: values.number.trim(),
    lineItems: values.lineItems.filter(
      (li) => li.description.trim().length > 0,
    ),
  };
}

const numToField = (n: number | null): string => (n === null ? "" : String(n));

export function draftToInvoiceValues(
  draft: ExtractedInvoice,
  fallbackCurrency: string,
): UpsertInvoiceValues {
  const lineItems: UpsertLineItem[] = draft.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity === null ? "1" : String(li.quantity),
    unit: li.unit ?? "",
    unitRate: numToField(li.unitRate),
  }));

  return {
    ...EMPTY_INVOICE,
    vendorName: draft.vendorName ?? "",
    number: draft.invoiceNumber ?? "",
    currency: draft.currency ?? fallbackCurrency,
    vatRate: draft.vatRate === null ? EMPTY_INVOICE.vatRate : String(draft.vatRate),
    whtRate: draft.whtRate === null ? EMPTY_INVOICE.whtRate : String(draft.whtRate),
    retentionRate:
      draft.retentionRate === null ? EMPTY_INVOICE.retentionRate : String(draft.retentionRate),
    issueDate: draft.issueDate ?? "",
    dueDate: draft.dueDate ?? "",
    notes: draft.notes ?? "",
    lineItems: lineItems.length > 0 ? lineItems : [emptyLine()],
  };
}
