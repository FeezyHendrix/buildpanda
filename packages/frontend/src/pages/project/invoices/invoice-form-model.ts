import { type InvoiceStatus, type InvoiceType } from "@/hooks/use-invoices";

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
  recipientEmail: "",
  notes: "",
  lineItems: [emptyLine()],
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function lineAmount(line: UpsertLineItem): number {
  return round2(Number(line.quantity || "0") * Number(line.unitRate || "0"));
}

export function computeTotals(values: UpsertInvoiceValues): InvoiceTotals {
  const subtotal = round2(
    values.lineItems.reduce((sum, li) => sum + lineAmount(li), 0),
  );
  const vat = round2((subtotal * Number(values.vatRate || "0")) / 100);
  const wht = round2((subtotal * Number(values.whtRate || "0")) / 100);
  const retention = round2(
    (subtotal * Number(values.retentionRate || "0")) / 100,
  );
  const totalInvoiced = round2(subtotal + vat);
  const netPayable = round2(totalInvoiced - wht - retention);
  return { subtotal, vat, wht, retention, totalInvoiced, netPayable };
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
