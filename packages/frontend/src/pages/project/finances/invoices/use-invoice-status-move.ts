import { useEditInvoice, type Invoice, type InvoiceStatus } from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { toInput, toValues } from "../../invoices/invoice-utils";
import { invoiceStatusLabel } from "./invoice-model";

/**
 * Moves an invoice along its workflow (Draft → Sent → Submitted → Approved…).
 * The status used to be an inline select on every row; it now lives in the row
 * and sheet menus, but the rule is the same: only the statuses the invoice may
 * reach next (`nextInvoiceStatuses`) are offered, and the move is recorded at once.
 */
export function useInvoiceStatusMove(projectId: string) {
  const edit = useEditInvoice();
  return {
    isPending: edit.isPending,
    move: (invoice: Invoice, status: InvoiceStatus) =>
      edit.mutate(
        { projectId, invoiceId: invoice.id, ...toInput(toValues(invoice)), status },
        {
          onSuccess: () => toast(`Invoice marked ${invoiceStatusLabel(status).toLowerCase()}`, "success"),
          onError: (error) => toast(getApiErrorMessage(error, "Could not update the invoice status"), "error"),
        },
      ),
  };
}
