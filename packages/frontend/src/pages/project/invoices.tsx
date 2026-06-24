import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { InvoiceAgingBar } from "@/components/organisms/charts/invoice-aging-bar";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  FinancesIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
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
  useInvoiceAllocations,
  useSetInvoiceAllocations,
  type Invoice,
  type InvoiceInput,
} from "@/hooks/use-invoices";
import { useProjectBudget } from "@/hooks/use-budget";
import { formatCurrency, currencySymbol } from "@/lib/formatters";
import { INVOICE_STATUS_TONE as STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { MoneyInput } from "@/components/atoms/money-input";

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
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const currency = project.currency;
  const { data: invoices = [], isPending } = useProjectInvoices(project.id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useReportingSnapshot(project.id);
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
    <div className="w-full px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Invoices" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Invoices"
        description="Track vendor invoices, retainage withheld, and payments made across the project."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            New invoice
          </Button>
        ) : undefined}
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
        className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4"
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

      {snapshot && (
        <section className="mt-6">
          <div className="lg:w-1/2">
            <InvoiceAgingBar 
              aging={snapshot.finance.invoices.aging} 
              currency={snapshot.currency} 
              isLoading={isSnapshotLoading} 
            />
          </div>
        </section>
      )}

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : invoices.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<FinancesIcon className="size-6" />}
              title="No invoices yet"
              description="Record vendor invoices to track what you owe, retainage withheld, and payments made on this project."
              action={canManage ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateOpen(true)}
                >
                  <PlusIcon className="size-4" />
                  New invoice
                </Button>
              ) : undefined}
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

function InvoiceBudgetAllocations({ projectId, invoice, currency }: { projectId: string; invoice: Invoice; currency: string }) {
  const { data: budget } = useProjectBudget(projectId);
  const { data: allocationsData = [], isPending } = useInvoiceAllocations(projectId, invoice.id);
  const setAllocations = useSetInvoiceAllocations();

  const [allocations, setAllocationsState] = useState<Array<{categoryId: string; amount: string}>>([]);

  useEffect(() => {
    if (!isPending) {
      if (allocationsData.length > 0) {
        setAllocationsState(allocationsData.map(a => ({ categoryId: a.budgetCategoryId, amount: String(a.amount) })));
      } else {
        const first = budget?.categories?.[0];
        if (first) {
          setAllocationsState([{ categoryId: first.id, amount: String(invoice.amount) }]);
        }
      }
    }
  }, [allocationsData, isPending, budget?.categories, invoice.amount]);

  if (isPending || !budget) return null;

  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const isOver = totalAllocated > invoice.amount;

  function handleSave() {
    setAllocations.mutate({
      projectId,
      invoiceId: invoice.id,
      allocations: allocations
        .filter(a => a.categoryId && Number(a.amount) > 0)
        .map(a => ({ budgetCategoryId: a.categoryId, amount: Number(a.amount) }))
    });
  }

  function addRow() {
    const first = budget?.categories?.[0];
    if (first) {
      setAllocationsState([...allocations, { categoryId: first.id, amount: "" }]);
    }
  }

  function updateRow(idx: number, field: "categoryId" | "amount", val: string) {
    setAllocationsState(
      allocations.map((row, i) => (i === idx ? { ...row, [field]: val } : row)),
    );
  }

  function removeRow(idx: number) {
    setAllocationsState(allocations.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[#F0F0F0] pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
        Charge to budget category
      </p>
      <div className="flex flex-col gap-2">
        {allocations.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={a.categoryId}
              onChange={e => updateRow(i, "categoryId", e.target.value)}
              className="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              {budget.categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <MoneyInput
              currencySymbol={currencySymbol(currency)}
              value={a.amount}
              onChange={val => updateRow(i, "amount", val)}
              className="w-32 h-9 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <Button variant="ghost" size="sm" className="h-9 text-red-500" onClick={() => removeRow(i)}>
              ✕
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={addRow}>+ Add category</Button>
        <div className="flex items-center gap-4">
          <span className={cn("text-sm font-medium", isOver ? "text-red-600" : "text-gray-700")}>
            Total: {formatCurrency(totalAllocated, currency)} / {formatCurrency(invoice.amount, currency)}
          </span>
          <Button 
            variant="primary" 
            size="sm" 
            disabled={setAllocations.isPending || isOver} 
            onClick={handleSave}
          >
            Save allocations
          </Button>
        </div>
      </div>
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

      <InvoiceBudgetAllocations projectId={projectId} invoice={invoice} currency={currency} />

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
