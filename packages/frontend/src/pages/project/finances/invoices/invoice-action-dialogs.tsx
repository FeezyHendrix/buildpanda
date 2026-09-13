import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import { SendInvoiceDialog, type SendInvoiceValues } from "@/components/molecules/send-invoice-dialog";
import { UpsertInvoiceDialog, type UpsertInvoiceValues } from "@/components/molecules/upsert-invoice-dialog";
import {
  useDeleteInvoice,
  useEditInvoice,
  useInvoicePdf,
  useQueryInvoice,
  useSendInvoice,
  useVoidInvoice,
  type Invoice,
} from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import type { Currency } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { toInput, toValues } from "../../invoices/invoice-utils";
import { invoiceLabel, saveInvoicePdf } from "./invoice-model";
import { PayApplicationDrawer } from "./pay-application-drawer";

/**
 * The dialogs an invoice row or drawer can open, hosted once per page so every
 * entry point shares them.
 *
 * Delete only exists for a certificate nothing has been paid against. Once a
 * receipt is on it the record is an accounting one: it is VOIDED with a reason,
 * which keeps it and its receipts on file and reverses its figures. A client
 * query is a formal dispute and carries a reason too.
 */

export type InvoiceAction = "edit" | "send" | "delete" | "void" | "query" | "pay-application";

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
  /** Called after a delete or void succeeds so an open drawer reacts too. */
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
  const voidInvoice = useVoidInvoice();
  const queryInvoice = useQueryInvoice();

  if (!invoice) return null;

  function handleEdit(values: UpsertInvoiceValues): void {
    if (!invoice) return;
    edit.mutate({ projectId, invoiceId: invoice.id, ...toInput(values) }, { onSuccess: () => onClose() });
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
        // The API refuses a delete once payments exist and names void instead.
        onError: (error) => toast(getApiErrorMessage(error, "Could not delete invoice")),
      },
    );
  }

  function handleVoid(reason: string): void {
    if (!invoice) return;
    voidInvoice.mutate(
      { projectId, invoiceId: invoice.id, reason },
      {
        onSuccess: () => {
          toast("Invoice voided", "success");
          onClose();
        },
      },
    );
  }

  function handleQuery(reason: string): void {
    if (!invoice) return;
    queryInvoice.mutate(
      { projectId, invoiceId: invoice.id, reason },
      {
        onSuccess: () => {
          toast("Query recorded", "success");
          onClose();
        },
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
        projectId={projectId}
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

      <ReasonDialog
        open={action === "query"}
        onOpenChange={closeIf}
        title={`Query ${invoiceLabel(invoice)}`}
        description="A query is a formal dispute on a certificate. It holds the ladder until it is answered, and the reason goes on the record with your name and the date."
        label="What is being queried?"
        placeholder="e.g. Stage 2 measured at 25% but the site record says 18% — evidence requested."
        submitLabel="Record query"
        onSubmit={handleQuery}
        isSubmitting={queryInvoice.isPending}
        error={queryInvoice.error ? getApiErrorMessage(queryInvoice.error) : null}
      />

      <ReasonDialog
        open={action === "void"}
        onOpenChange={closeIf}
        title={`Void ${invoiceLabel(invoice)}`}
        description="Voiding keeps the certificate and every receipt recorded against it on file, and reverses its figures on the contract position. It cannot be undone."
        label="Why is this certificate being voided?"
        placeholder="e.g. Superseded by IPC-002 after the re-measurement was agreed."
        submitLabel="Void certificate"
        onSubmit={handleVoid}
        isSubmitting={voidInvoice.isPending}
        error={voidInvoice.error ? getApiErrorMessage(voidInvoice.error) : null}
      />

      <ConfirmDialog
        open={action === "delete"}
        onOpenChange={closeIf}
        title={`Delete invoice from ${invoice.vendorName}?`}
        description="This removes the draft invoice. Once a payment has been recorded against it the invoice is an accounting record and must be voided instead."
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
