import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { KpiCard } from "@/components/molecules/kpi-card";
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
  const { data: summary, isPending } = useFinancePosition(project.id);
  // The payment ledger is still part of the legacy finances payload.
  const { data: finances } = useProjectFinances(project.id);

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
      <TabActions>
        {isSettled(summary) ? (
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

      {finances ? <PaymentLedgerTable entries={finances.ledger} currency={currency} /> : null}
    </section>
  );
}

FinalAccountSection.displayName = "FinalAccountSection";
