import { type Invoice, type InvoiceInput } from "@/hooks/use-invoices";
import { type UpsertInvoiceValues } from "@/components/molecules/upsert-invoice-dialog";

export function toInput(values: UpsertInvoiceValues): InvoiceInput {
  return {
    vendorName: values.vendorName,
    trade: values.trade,
    number: values.number || undefined,
    status: values.status,
    invoiceType: values.invoiceType,
    currency: values.currency || undefined,
    vatRate: values.vatRate === "" ? undefined : Number(values.vatRate),
    whtRate: values.whtRate === "" ? undefined : Number(values.whtRate),
    retentionRate: values.retentionRate === "" ? undefined : Number(values.retentionRate),
    issueDate: values.issueDate || undefined,
    dueDate: values.dueDate || undefined,
    paymentTerms: values.paymentTerms || undefined,
    recipientEmail: values.recipientEmail || undefined,
    notes: values.notes || undefined,
    lineItems: values.lineItems
      .filter((li) => li.description.trim().length > 0)
      .map((li) => ({
        description: li.description.trim(),
        quantity: li.quantity === "" ? undefined : Number(li.quantity),
        unit: li.unit || undefined,
        unitRate: li.unitRate === "" ? undefined : Number(li.unitRate),
      })),
  };
}

export function toValues(invoice: Invoice): UpsertInvoiceValues {
  return {
    vendorName: invoice.vendorName,
    trade: invoice.trade,
    number: invoice.number ?? "",
    status: invoice.status,
    invoiceType: invoice.invoiceType,
    currency: invoice.currency,
    vatRate: String(invoice.vatRate ?? ""),
    whtRate: String(invoice.whtRate ?? ""),
    retentionRate: String(invoice.retentionRate ?? ""),
    issueDate: invoice.issueDate ?? "",
    dueDate: invoice.dueDate ?? "",
    paymentTerms: invoice.paymentTerms ?? "",
    recipientEmail: invoice.recipientEmail ?? "",
    notes: invoice.notes ?? "",
    lineItems:
      invoice.lineItems.length > 0
        ? invoice.lineItems.map((li) => ({
            description: li.description,
            quantity: String(li.quantity),
            unit: li.unit ?? "",
            unitRate: String(li.unitRate),
          }))
        : [{ description: "", quantity: "1", unit: "", unitRate: "" }],
  };
}
