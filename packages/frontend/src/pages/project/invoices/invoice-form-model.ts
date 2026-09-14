import { type InvoiceDirection, type InvoiceType, type ExtractedInvoice } from "@/hooks/use-invoices";
import { INPUT_CLASS } from "@/components/atoms/input";
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
  /**
   * Which way the certificate points. A client invoice is RECEIVABLE — the
   * party on it is the employer, never a "vendor"; a supplier bill is PAYABLE.
   */
  direction: InvoiceDirection;
  /** The contract this bills against; the main contract by default. */
  contractId: string;
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

/**
 * The certificate types we raise to the employer are receivable; a vendor or
 * material bill is what a supplier sends us. Picking the type therefore picks
 * the direction, which is what stops the employer being labelled "Vendor".
 */
export const TYPES: { value: InvoiceType; label: string; direction: InvoiceDirection }[] = [
  { value: "progress", label: "Progress / IPC", direction: "receivable" },
  { value: "advance", label: "Advance / mobilisation", direction: "receivable" },
  { value: "variation", label: "Variation", direction: "receivable" },
  { value: "final", label: "Final account", direction: "receivable" },
  { value: "vendor", label: "Vendor invoice", direction: "payable" },
  { value: "material", label: "Material", direction: "payable" },
];

export function directionForType(type: InvoiceType): InvoiceDirection {
  return TYPES.find((entry) => entry.value === type)?.direction ?? "payable";
}

/** What the other party is called on this invoice. */
export function partyLabel(direction: InvoiceDirection): string {
  return direction === "payable" ? "Vendor / payee" : "Client / employer";
}

export const inputClass = INPUT_CLASS;

export function emptyLine(): UpsertLineItem {
  return { description: "", quantity: "1", unit: "", unitRate: "" };
}

export const EMPTY_INVOICE: UpsertInvoiceValues = {
  vendorName: "",
  trade: "",
  number: "",
  direction: "payable",
  contractId: "",
  invoiceType: "vendor",
  currency: "NGN",
  vatRate: "0",
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

/**
 * Trade is required by the API, and it used to sit inside a collapsed section —
 * so Save answered 400 with nothing on screen. It is a first-class field now
 * and the form will not submit without it.
 */
export function isInvoiceValid(values: UpsertInvoiceValues): boolean {
  return (
    values.vendorName.trim().length > 0 &&
    values.trade.trim().length > 0 &&
    countValidLines(values) > 0
  );
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
