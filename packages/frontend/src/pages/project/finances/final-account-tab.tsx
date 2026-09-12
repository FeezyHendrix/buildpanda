import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectFinances } from "@/hooks/use-finances";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";
import { TabHeader } from "./finance-tabs";
import { ClosingChecklist } from "./final-account/closing-checklist";
import { PaymentLedgerTable } from "./final-account/payment-ledger-table";
import { SettlementStatement, computeSettlement } from "./settlement-statement";

/**
 * Final account — the closing statement read from certified, paid and held
 * figures. A view over recorded amounts; nothing here is settled by BuildPanda.
 */
export function FinalAccountTab() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!finances) {
    return (
      <EmptyState
        icon={<FinancesIcon />}
        title="No finance data yet"
        description="The closing statement is built from certified, paid and held amounts once the project's finances are set up."
      />
    );
  }

  const currency = finances.currency;
  const settlement = computeSettlement(finances, snapshot?.finance?.invoices?.retentionHeld ?? 0);

  return (
    <section aria-label="Final account">
      <TabHeader
        heading="Final account"
        description="How the outstanding balance is computed at closing."
        actions={
          settlement.isSettled ? (
            <Badge tone="success" size="md" className="gap-1.5">
              <span aria-hidden="true">✓</span>
              Settled
            </Badge>
          ) : undefined
        }
      />

      <section
        aria-label="Final account summary"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard label="Adjusted contract" value={formatCurrency(finances.adjustedContract, currency)} />
        <KpiCard label="Amount paid" value={formatCurrency(finances.amountPaidToDate, currency)} />
        <KpiCard label="Retention held" value={formatCurrency(settlement.retentionHeld, currency)} />
        <KpiCard label="Outstanding" value={formatCurrency(settlement.outstanding, currency)} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card padding="lg" className="lg:col-span-3">
          <div className="mb-4">
            <h3 className="text-[13px] font-semibold text-black-300">Settlement statement</h3>
            <p className="mt-1 text-xs text-gray-500">
              How the outstanding balance is computed at closing.
            </p>
          </div>
          <SettlementStatement finances={finances} settlement={settlement} />
        </Card>

        <ClosingChecklist settlement={settlement} />
      </div>

      <PaymentLedgerTable entries={finances.ledger} currency={currency} />
    </section>
  );
}

FinalAccountTab.displayName = "FinalAccountTab";
