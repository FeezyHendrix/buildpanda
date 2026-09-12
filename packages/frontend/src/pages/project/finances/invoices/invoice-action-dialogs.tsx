import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SendInvoiceDialog, type SendInvoiceValues } from "@/components/molecules/send-invoice-dialog";
import { UpsertInvoiceDialog, type UpsertInvoiceValues } from "@/components/molecules/upsert-invoice-dialog";
import {
  useDeleteInvoice,
  useEditInvoice,
  useInvoicePdf,
  useSendInvoice,
  type Invoice,
} from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Currency } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { toInput, toValues } from "../../invoices/invoice-utils";
import { invoiceLabel, saveInvoicePdf } from "./invoice-model";
import { PayApplicationDrawer } from "./pay-application-drawer";

/**
 * The dialogs an invoice row or drawer can open — edit, send, delete and the
 * pay application — hosted once per page so every entry point shares them.
 * Sending or editing records the invoice; nothing here charges anyone.
 */

export type InvoiceAction = "edit" | "send" | "delete" | "pay-application";

/** Imperative PDF download shared by the row menu and the drawer footer. */
export function useDownloadInvoicePdf(projectId: string) {
  const pdf = useInvoicePdf();
  return {
    isPending: pdf.isPending,
    download: (invoice: Invoice) =>
      pdf.mutate(
        { projectId, invoiceId: invoice.id },
        {
          onSuccess: (blob) => saveInvoicePdf(blob as Blob, invoice),
          onError: () => toast("Could not generate PDF"),
        },
      ),
  };
}

interface InvoiceActionDialogsProps {
  projectId: string;
  currency: Currency;
  canManage: boolean;
  invoice: Invoice | null;
  action: InvoiceAction | null;
  onClose: () => void;
  /** Called after a delete succeeds so an open drawer for that invoice closes too. */
  onDeleted?: (invoiceId: string) => void;
}

export function InvoiceActionDialogs({
  projectId,
  currency,
  canManage,
  invoice,
  action,
  onClose,
  onDeleted,
}: InvoiceActionDialogsProps) {
  const edit = useEditInvoice();
  const send = useSendInvoice();
  const remove = useDeleteInvoice();

  if (!invoice) return null;

  function handleEdit(values: UpsertInvoiceValues): void {
    if (!invoice) return;
    edit.mutate(
      { projectId, invoiceId: invoice.id, ...toInput(values) },
      { onSuccess: () => onClose() },
    );
  }

  function handleSend(values: SendInvoiceValues): void {
    if (!invoice) return;
    send.mutate(
      { projectId, invoiceId: invoice.id, ...values },
      {
        onSuccess: () => {
          onClose();
          toast("Invoice sent", "success");
        },
        onError: (error) => toast(getApiErrorMessage(error, "Could not send invoice")),
      },
    );
  }

  function handleDelete(): void {
    if (!invoice) return;
    remove.mutate(
      { projectId, invoiceId: invoice.id },
      {
        onSuccess: () => {
          onDeleted?.(invoice.id);
          onClose();
        },
        onError: (error) => toast(getApiErrorMessage(error, "Could not delete invoice")),
      },
    );
  }

  const closeIf = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <>
      <UpsertInvoiceDialog
        open={action === "edit"}
        onOpenChange={closeIf}
        mode="edit"
        initial={toValues(invoice)}
        onSubmit={handleEdit}
        isSubmitting={edit.isPending}
        error={edit.error ? getApiErrorMessage(edit.error) : null}
        currency={invoice.currency || currency}
      />

      <SendInvoiceDialog
        open={action === "send"}
        onOpenChange={closeIf}
        defaultRecipient={invoice.recipientEmail ?? invoice.toParty?.email ?? null}
        onSubmit={handleSend}
        isSubmitting={send.isPending}
        error={send.error ? getApiErrorMessage(send.error) : null}
      />

      <ConfirmDialog
        open={action === "delete"}
        onOpenChange={closeIf}
        title={`Delete invoice from ${invoice.vendorName}?`}
        description="This removes the invoice and all of its recorded payments. This cannot be undone."
        confirmLabel="Delete invoice"
        variant="danger"
        loading={remove.isPending}
        onConfirm={handleDelete}
      />

      {invoice.invoiceType === "progress" ? (
        <PayApplicationDrawer
          open={action === "pay-application"}
          onOpenChange={closeIf}
          projectId={projectId}
          invoiceId={invoice.id}
          invoiceLabel={invoiceLabel(invoice)}
          currency={(invoice.currency as Currency) || currency}
          canManage={canManage}
        />
      ) : null}
    </>
  );
}

InvoiceActionDialogs.displayName = "InvoiceActionDialogs";
