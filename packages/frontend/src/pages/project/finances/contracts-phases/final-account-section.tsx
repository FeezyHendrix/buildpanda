import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
import { QueryError } from "@/components/molecules/query-error";
import { useFinancePosition, useProjectFinances } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";
import { TabActions } from "../finance-tabs";
import { ClosingChecklist } from "../final-account/closing-checklist";
import { PaymentLedgerTable } from "../final-account/payment-ledger-table";
import { SettlementStatement, isSettled } from "../settlement-statement";

/**
 * Final account — the closing statement, read from the same one money model as
 * the finance overview so the two can never disagree. A view over recorded
 * amounts; nothing here is settled by BuildPanda.
 */
export function FinalAccountSection() {
  const { project } = useProjectContext();
  const { data: summary, isPending, error, refetch } = useFinancePosition(project.id);
  // The payment ledger is still part of the legacy finances payload.
  const ledger = useProjectFinances(project.id);

  if (error && !summary) return <QueryError error={error} retry={refetch} noun="the final account" />;

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!summary) {
    return (
      <EmptyState
        icon={<FinancesIcon />}
        title="No finance data yet"
        description="The closing statement is built from certified, paid and held amounts once the project's finances are set up."
      />
    );
  }

  const currency = summary.currency;

  return (
    <section aria-label="Final account">
      {error ? <QueryError error={error} retry={refetch} noun="the final account" /> : null}
      <TabActions>
        {!error && isSettled(summary) ? (
          <Badge tone="success" size="md" className="gap-1.5">
            <span aria-hidden="true">✓</span>
            Settled
          </Badge>
        ) : null}
      </TabActions>

      <section aria-label="Final account summary" className="grid grid-cols-2 gap-4">
        <KpiCard label="Adjusted contract" value={formatCurrency(summary.adjustedContract, currency)} />
        <KpiCard label="Certified to date" value={formatCurrency(summary.certifiedGrossToDate, currency)} />
        <KpiCard label="Paid to date" value={formatCurrency(summary.amountPaidToDate, currency)} />
        <KpiCard label="Retention held" value={formatCurrency(summary.retentionHeld, currency)} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <Card padding="lg">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-ink-muted">Settlement statement</h3>
            <p className="mt-1 text-xs text-ink-muted">
              How the closing position is reached, from the certificates and the receipts recorded
              against them.
            </p>
          </div>
          <SettlementStatement summary={summary} />
        </Card>

        <ClosingChecklist summary={summary} />
      </div>

      {ledger.error ? <QueryError error={ledger.error} retry={ledger.refetch} noun="funding activity" /> : null}
      {ledger.isPending ? <div className="mt-6" role="status" aria-label="Loading funding activity"><Spinner /></div> : null}
      {ledger.data ? <PaymentLedgerTable entries={ledger.data.ledger} currency={currency}
        paymentsPath={`/project/${project.id}/finances/budget-invoices?tab=payments`} /> : null}
    </section>
  );
}

FinalAccountSection.displayName = "FinalAccountSection";
