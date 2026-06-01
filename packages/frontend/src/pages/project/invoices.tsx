import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  FinancesIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import {
  RecordPaymentDialog,
  type RecordPaymentValues,
} from "@/components/molecules/record-payment-dialog";
import {
  UpsertInvoiceDialog,
  type UpsertInvoiceValues,
} from "@/components/molecules/upsert-invoice-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectInvoices,
  useCreateInvoice,
  useEditInvoice,
  useDeleteInvoice,
  useAddInvoicePayment,
  useDeleteInvoicePayment,
  type Invoice,
  type InvoiceInput,
  type InvoiceStatus,
} from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<
  InvoiceStatus,
  "neutral" | "info" | "accent" | "success"
> = {
  Draft: "neutral",
  Submitted: "info",
  Approved: "accent",
  Paid: "success",
};

function toInput(values: UpsertInvoiceValues): InvoiceInput {
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

function toValues(invoice: Invoice): UpsertInvoiceValues {
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

export default function ProjectInvoices() {
  const { project } = useProjectContext();
  const currency = project.currency;
  const { data: invoices = [], isPending } = useProjectInvoices(project.id);
  const [createOpen, setCreateOpen] = useState(false);
  const createInvoice = useCreateInvoice();

  const summary = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        acc.billed += inv.amount;
        acc.retainage += inv.retainageAmount;
        acc.paid += inv.amountPaid;
        acc.balance += inv.balanceDue;
        return acc;
      },
      { billed: 0, retainage: 0, paid: 0, balance: 0 },
    );
  }, [invoices]);

  function handleCreate(values: UpsertInvoiceValues): void {
    createInvoice.mutate(
      { projectId: project.id, ...toInput(values) },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Invoices"
        description="Track vendor invoices, retainage withheld, and payments made across the project."
        actions={
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New invoice
          </Button>
        }
      />

      <UpsertInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSubmit={handleCreate}
        isSubmitting={createInvoice.isPending}
        error={(createInvoice.error as Error | undefined)?.message ?? null}
      />

      <section
        aria-label="Invoice summary"
        className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <SummaryTile
          label="Total Billed"
          value={formatCurrency(summary.billed, currency)}
        />
        <SummaryTile
          label="Retainage Held"
          value={formatCurrency(summary.retainage, currency)}
        />
        <SummaryTile
          label="Amount Paid"
          value={formatCurrency(summary.paid, currency)}
        />
        <SummaryTile
          label="Balance Due"
          value={formatCurrency(summary.balance, currency)}
          accent
        />
      </section>

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
          </div>
        ) : invoices.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<FinancesIcon className="size-6" />}
              title="No invoices yet"
              description="Record vendor invoices to track what you owe, retainage withheld, and payments made on this project."
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  New invoice
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                projectId={project.id}
                invoice={invoice}
                currency={currency}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InvoiceCard({
  projectId,
  invoice,
  currency,
}: {
  projectId: string;
  invoice: Invoice;
  currency: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  const editInvoice = useEditInvoice();
  const deleteInvoice = useDeleteInvoice();
  const addPayment = useAddInvoicePayment();
  const deletePayment = useDeleteInvoicePayment();

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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPaymentOpen(true)}
          >
            Record payment
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Amount" value={formatCurrency(invoice.amount, currency)} />
        <Metric
          label={`Retainage (${invoice.retainagePercentage}%)`}
          value={formatCurrency(invoice.retainageAmount, currency)}
        />
        <Metric
          label="Paid"
          value={formatCurrency(invoice.amountPaid, currency)}
        />
        <Metric
          label="Balance Due"
          value={formatCurrency(invoice.balanceDue, currency)}
          accent
        />
      </div>

      {invoice.notes && (
        <p className="text-sm text-gray-600 text-pretty">{invoice.notes}</p>
      )}

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
              <button
                type="button"
                onClick={() => setDeletePaymentId(payment.id)}
                className="text-xs font-medium text-gray-400 hover:text-[#C72525]"
              >
                Remove
              </button>
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

function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <KpiCard label={label} padding="md">
      <p
        className={cn(
          "text-base font-bold tabular-nums",
          accent ? "text-[#004DE7]" : "text-gray-900",
        )}
      >
        {value}
      </p>
    </KpiCard>
  );
}

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
