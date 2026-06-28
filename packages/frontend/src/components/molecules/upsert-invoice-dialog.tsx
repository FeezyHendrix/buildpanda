import { useEffect } from "react";
import { FormDrawer } from "./form-drawer";
import { formatCurrency } from "@/lib/formatters";
import {
  EMPTY_INVOICE,
  sanitizeInvoice,
  type UpsertInvoiceValues,
  type UpsertLineItem,
} from "@/pages/project/invoices/invoice-form-model";
import { useInvoiceForm } from "@/pages/project/invoices/use-invoice-form";
import { InvoiceForm } from "@/pages/project/invoices/invoice-form";

export type { UpsertInvoiceValues, UpsertLineItem };

interface UpsertInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertInvoiceValues;
  onSubmit: (values: UpsertInvoiceValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
  currency?: string;
}

function UpsertInvoiceDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
  currency = "NGN",
}: UpsertInvoiceDialogProps) {
  const form = useInvoiceForm();

  useEffect(() => {
    if (open) form.reset(initial ?? { ...EMPTY_INVOICE, currency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, currency]);

  const money = (n: number): string =>
    formatCurrency(n, form.values.currency || currency);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit invoice" : "New invoice"}
      description={
        mode === "edit"
          ? "Update line items, taxes and details for this invoice."
          : "Build a construction invoice with line items, VAT, WHT and retention."
      }
      submitLabel={mode === "edit" ? "Save changes" : "Create invoice"}
      submitDisabled={!form.isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={() => onSubmit(sanitizeInvoice(form.values))}
      className="w-[min(720px,100vw)]"
    >
      <InvoiceForm form={form} money={money} />
    </FormDrawer>
  );
}

UpsertInvoiceDialog.displayName = "UpsertInvoiceDialog";

export { UpsertInvoiceDialog };
