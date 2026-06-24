import { type Invoice, type InvoiceInput } from "@/hooks/use-invoices";
import { type UpsertInvoiceValues } from "@/components/molecules/upsert-invoice-dialog";

export function toInput(values: UpsertInvoiceValues): InvoiceInput {
  return {
    vendorName: values.vendorName,
    trade: values.trade,
    number: values.number || undefined,
    status: values.status,
    amount: Number(values.amount),
    retainagePercentage: Number(values.retainagePercentage || "0"),
    issueDate: values.issueDate || undefined,
    dueDate: values.dueDate || undefined,
    notes: values.notes || undefined,
  };
}

export function toValues(invoice: Invoice): UpsertInvoiceValues {
  return {
    vendorName: invoice.vendorName,
    trade: invoice.trade,
    number: invoice.number ?? "",
    status: invoice.status,
    amount: String(invoice.amount),
    retainagePercentage: String(invoice.retainagePercentage),
    issueDate: invoice.issueDate ?? "",
    dueDate: invoice.dueDate ?? "",
    notes: invoice.notes ?? "",
  };
}
