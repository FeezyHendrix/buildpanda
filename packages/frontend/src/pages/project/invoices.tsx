import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { InvoiceAgingBar } from "@/components/organisms/charts/invoice-aging-bar";

import { useMemo, useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import {
  UpsertInvoiceDialog,
  type UpsertInvoiceValues,
} from "@/components/molecules/upsert-invoice-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectInvoices, useCreateInvoice } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import { toInput } from "./invoices/invoice-utils";
import { InvoiceCard } from "./invoices/invoice-card";
import { SummaryTile } from "./invoices/summary-tile";

export default function ProjectInvoices() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const currency = project.currency;
  const { data: invoices = [], isPending } = useProjectInvoices(project.id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useReportingSnapshot(
    project.id,
  );
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
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
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
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon className="size-4" />
              New invoice
            </Button>
          ) : undefined
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
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setCreateOpen(true)}
                  >
                    <PlusIcon className="size-4" />
                    New invoice
                  </Button>
                ) : undefined
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
