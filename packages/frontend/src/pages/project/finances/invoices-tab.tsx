import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { FinancesIcon, PlusIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { ScanInvoiceDialog } from "@/components/molecules/scan-invoice-dialog";
import { InvoiceAgingBar } from "@/components/organisms/charts/invoice-aging-bar";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectInvoices, type InvoiceScanResult } from "@/hooks/use-invoices";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { InvoiceCard } from "../invoices/invoice-card";
import { InvoiceComposer } from "../invoices/invoice-composer";
import { PERIOD_PATTERN } from "./contract/billing-sheet-model";
import { TabActions } from "./finance-tabs";

/** Invoices — what's been billed, held back and paid. Sending records an invoice; it never charges. */
export function InvoicesTab() {
  const { project, access } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scanOpen, setScanOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<InvoiceScanResult | null>(null);
  const [composePeriod, setComposePeriod] = useState<string | null>(null);
  const canManage = canResourceAction(access, "finances", "manage");
  const currency = project.currency;
  const { data: invoices = [], isPending } = useProjectInvoices(project.id);
  const { data: snapshot, isLoading: isSnapshotLoading } = useReportingSnapshot(project.id);

  // The retired /invoices/new route (and any deep link) opens the composer via
  // ?compose=1; the billing sheet adds &period=YYYY-MM to seed a progress
  // invoice for that month. Consume both so a refresh doesn't reopen it.
  useEffect(() => {
    if (canManage && searchParams.get("compose") === "1") {
      const period = searchParams.get("period");
      setScanResult(null);
      setComposePeriod(period && PERIOD_PATTERN.test(period) ? period : null);
      setComposerOpen(true);
      searchParams.delete("compose");
      searchParams.delete("period");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        acc.billed += inv.totalInvoiced;
        acc.retainage += inv.retentionAmount;
        acc.paid += inv.amountPaid;
        acc.balance += inv.balanceDue;
        return acc;
      },
      { billed: 0, retainage: 0, paid: 0, balance: 0 },
    );
  }, [invoices]);

  function openComposer(): void {
    setScanResult(null);
    setComposePeriod(null);
    setComposerOpen(true);
  }

  const actions = canManage ? (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="md" onClick={() => setScanOpen(true)}>
        Scan invoice
      </Button>
      <Button variant="primary" size="md" onClick={openComposer}>
        <PlusIcon className="size-4" />
        Send invoice
      </Button>
    </div>
  ) : undefined;

  return (
    <section aria-label="Invoices">
      <TabActions>{actions}</TabActions>

      <section
        aria-label="Invoice summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard label="Total invoiced" value={formatCurrency(summary.billed, currency)} />
        <KpiCard label="Held back" value={formatCurrency(summary.retainage, currency)} />
        <KpiCard label="Paid" value={formatCurrency(summary.paid, currency)} />
        <KpiCard label="Outstanding" value={formatCurrency(summary.balance, currency)} />
      </section>

      {snapshot ? (
        <section className="mt-6">
          <div className="lg:w-1/2">
            <InvoiceAgingBar
              aging={snapshot.finance.invoices.aging}
              currency={snapshot.currency}
              isLoading={isSnapshotLoading}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FinancesIcon />}
            title="No invoices yet"
            description="Send an invoice or record a bill to track what's billed, held back, and paid."
            action={canManage ? { label: "Send invoice", onClick: openComposer, icon: <PlusIcon /> } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                projectId={project.id}
                invoice={invoice}
                currency={currency}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>

      <ScanInvoiceDialog
        projectId={project.id}
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScanned={(result) => {
          setScanResult(result);
          setComposerOpen(true);
        }}
      />

      {canManage ? (
        <InvoiceComposer
          projectId={project.id}
          currency={currency}
          open={composerOpen}
          onOpenChange={setComposerOpen}
          scan={scanResult}
          period={composePeriod}
        />
      ) : null}
    </section>
  );
}

InvoicesTab.displayName = "InvoicesTab";
