import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  RecordPaymentDialog,
  type RecordPaymentValues,
} from "@/components/molecules/record-payment-dialog";
import {
  UpsertInvoiceDialog,
  type UpsertInvoiceValues,
} from "@/components/molecules/upsert-invoice-dialog";
import {
  SendInvoiceDialog,
  type SendInvoiceValues,
} from "@/components/molecules/send-invoice-dialog";
import {
  useEditInvoice,
  useDeleteInvoice,
  useAddInvoicePayment,
  useDeleteInvoicePayment,
  useSendInvoice,
  useInvoicePdf,
  type Invoice,
} from "@/hooks/use-invoices";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/formatters";
import { INVOICE_STATUS_TONE as STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { toInput, toValues } from "./invoice-utils";
import { InvoiceBudgetAllocations } from "./invoice-budget-allocations";

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-[#004DE7]" : "text-gray-900",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function InvoiceCard({
  projectId,
  invoice,
  currency,
  canManage,
}: {
  projectId: string;
  invoice: Invoice;
  currency: string;
  canManage: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const editInvoice = useEditInvoice();
  const deleteInvoice = useDeleteInvoice();
  const addPayment = useAddInvoicePayment();
  const deletePayment = useDeleteInvoicePayment();
  const sendInvoice = useSendInvoice();
  const invoicePdf = useInvoicePdf();

  function handleSend(values: SendInvoiceValues): void {
    sendInvoice.mutate(
      { projectId, invoiceId: invoice.id, ...values },
      {
        onSuccess: () => {
          setSendOpen(false);
          toast("Invoice sent", "success");
        },
        onError: () => toast("Could not send invoice"),
      },
    );
  }

  function handleDownloadPdf(): void {
    invoicePdf.mutate(
      { projectId, invoiceId: invoice.id },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob as Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `invoice-${invoice.number || invoice.id}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        },
        onError: () => toast("Could not generate PDF"),
      },
    );
  }

  function handleEdit(values: UpsertInvoiceValues): void {
    editInvoice.mutate(
      { projectId, invoiceId: invoice.id, ...toInput(values) },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleAddPayment(values: RecordPaymentValues): void {
    addPayment.mutate(
      {
        projectId,
        invoiceId: invoice.id,
        amount: Number(values.amount),
        method: values.method,
        paidAt: values.paidAt || undefined,
        note: values.note || undefined,
      },
      { onSuccess: () => setPaymentOpen(false) },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-gray-900">
              {invoice.vendorName}
            </p>
            <Badge tone={STATUS_TONE[invoice.status]} size="md">
              {invoice.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {invoice.trade}
            {invoice.number ? ` · ${invoice.number}` : ""}
            {invoice.dueDate ? ` · Due ${invoice.dueDate}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSendOpen(true)}
            >
              Send
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={invoicePdf.isPending}
          >
            {invoicePdf.isPending ? "…" : "PDF"}
          </Button>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPaymentOpen(true)}
            >
              Record payment
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Net payable" value={formatCurrency(invoice.netPayable, invoice.currency || currency)} />
        <Metric
          label={`Retention (${invoice.retentionRate}%)`}
          value={formatCurrency(invoice.retentionAmount, invoice.currency || currency)}
        />
        <Metric
          label="Paid"
          value={formatCurrency(invoice.amountPaid, invoice.currency || currency)}
        />
        <Metric
          label="Balance Due"
          value={formatCurrency(invoice.balanceDue, invoice.currency || currency)}
          accent
        />
      </div>

      {invoice.notes && (
        <p className="text-sm text-gray-600 text-pretty">{invoice.notes}</p>
      )}

      {invoice.paymentInstructions ? (
        <div className="flex flex-col gap-1 border-t border-[#F0F0F0] pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Payment details
          </p>
          <p className="whitespace-pre-line text-sm text-gray-600">
            {invoice.paymentInstructions}
          </p>
        </div>
      ) : null}

      <InvoiceBudgetAllocations projectId={projectId} invoice={invoice} currency={currency} canManage={canManage} />

      {invoice.payments.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[#F0F0F0] pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Payments
          </p>
          {invoice.payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-900 tabular-nums">
                  {formatCurrency(payment.amount, currency)}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {payment.method}
                  {payment.paidAt ? ` · ${payment.paidAt}` : ""}
                  {payment.note ? ` · ${payment.note}` : ""}
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setDeletePaymentId(payment.id)}
                  className="text-xs font-medium text-gray-400 hover:text-[#C72525]"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <UpsertInvoiceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={toValues(invoice)}
        onSubmit={handleEdit}
        isSubmitting={editInvoice.isPending}
        error={(editInvoice.error as Error | undefined)?.message ?? null}
      />

      <SendInvoiceDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        defaultRecipient={invoice.recipientEmail ?? invoice.toParty?.email ?? null}
        onSubmit={handleSend}
        isSubmitting={sendInvoice.isPending}
        error={(sendInvoice.error as Error | undefined)?.message ?? null}
      />

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        vendorName={invoice.vendorName}
        balanceDue={invoice.balanceDue}
        currency={currency}
        onSubmit={handleAddPayment}
        isSubmitting={addPayment.isPending}
        error={(addPayment.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete invoice from ${invoice.vendorName}?`}
        description="This removes the invoice and all of its recorded payments. This cannot be undone."
        confirmLabel="Delete invoice"
        variant="danger"
        onConfirm={() =>
          deleteInvoice.mutate({ projectId, invoiceId: invoice.id })
        }
      />

      <ConfirmDialog
        open={deletePaymentId !== null}
        onOpenChange={(next) => {
          if (!next) setDeletePaymentId(null);
        }}
        title="Remove this payment?"
        description="The payment will be removed and the balance due recalculated."
        confirmLabel="Remove payment"
        variant="danger"
        onConfirm={() => {
          if (!deletePaymentId) return;
          deletePayment.mutate({
            projectId,
            invoiceId: invoice.id,
            paymentId: deletePaymentId,
          });
          setDeletePaymentId(null);
        }}
      />
    </Card>
  );
}
