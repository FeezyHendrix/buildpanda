import { useState, type ChangeEvent } from "react";
import { Badge } from "@/components/atoms/badge";
import { useEditInvoice, type Invoice, type InvoiceStatus } from "@/hooks/use-invoices";
import { INVOICE_STATUS_TONE } from "@/lib/project-meta";
import { toast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { toInput, toValues } from "../../invoices/invoice-utils";
import { INVOICE_STATUS_LABEL, nextInvoiceStatuses } from "./invoice-model";

/**
 * Inline status control on an invoice row. It offers only the statuses the
 * invoice may move to next (`nextStatuses` from the DTO), so a Paid invoice
 * reads as a plain pill. Changing it records the new position immediately.
 */

const TONE_CLASS: Record<ReturnType<typeof toneOf>, string> = {
  neutral: "bg-neutral-50 text-neutral-500",
  success: "bg-success-50 text-success-500",
  warning: "bg-warning-50 text-warning-500",
  danger: "bg-negative-50 text-negative-500",
  info: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-500",
};

function toneOf(status: InvoiceStatus) {
  return INVOICE_STATUS_TONE[status];
}

interface InvoiceStatusSelectProps {
  projectId: string;
  invoice: Invoice;
  disabled?: boolean;
}

export function InvoiceStatusSelect({ projectId, invoice, disabled = false }: InvoiceStatusSelectProps) {
  const edit = useEditInvoice();
  const [pending, setPending] = useState<InvoiceStatus | null>(null);
  const next = nextInvoiceStatuses(invoice);
  const shown = pending ?? invoice.status;
  const tone = TONE_CLASS[toneOf(shown)];

  if (disabled || next.length === 0) {
    return (
      <Badge tone={toneOf(shown)} dot>
        {INVOICE_STATUS_LABEL[shown]}
      </Badge>
    );
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const status = event.target.value as InvoiceStatus;
    if (status === invoice.status) return;
    setPending(status);
    edit.mutate(
      { projectId, invoiceId: invoice.id, ...toInput(toValues(invoice)), status },
      {
        onSuccess: () => toast(`Invoice marked ${INVOICE_STATUS_LABEL[status].toLowerCase()}`, "success"),
        onError: (error) => toast(getApiErrorMessage(error, "Could not update the invoice status"), "error"),
        onSettled: () => setPending(null),
      },
    );
  }

  return (
    <select
      value={shown}
      onChange={handleChange}
      onClick={(event) => event.stopPropagation()}
      disabled={edit.isPending}
      aria-label={`Status of ${invoice.vendorName}`}
      className={cn(
        "h-7 w-auto max-w-[140px] cursor-pointer appearance-none rounded-full border-0 pl-2.5 pr-6 text-xs font-medium outline-none",
        "bg-[length:10px] bg-[right_8px_center] bg-no-repeat focus-visible:shadow-focus disabled:opacity-60",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%221.5%22 stroke-linecap=%22round%22><path d=%22m3 4.5 3 3 3-3%22/></svg>')]",
        tone,
      )}
    >
      <option value={invoice.status}>{INVOICE_STATUS_LABEL[invoice.status]}</option>
      {next.map((status) => (
        <option key={status} value={status}>
          {INVOICE_STATUS_LABEL[status]}
        </option>
      ))}
    </select>
  );
}

InvoiceStatusSelect.displayName = "InvoiceStatusSelect";
