import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { QueryError } from "@/components/molecules/query-error";
import { useFinancePosition, useProjectFinances } from "@/hooks/use-finances";
import { useProjectContext } from "@/layouts/project-layout";
import { formatCurrency } from "@/lib/formatters";
import { ClosingChecklist } from "../final-account/closing-checklist";
import { PaymentLedgerTable } from "../final-account/payment-ledger-table";
import { SettlementStatement, isSettled } from "../settlement-statement";
import { SheetDivider, SheetHeading, SheetKpi } from "./sheet-parts";

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

      <div aria-label="Final account summary" className="-mt-[2px] grid grid-cols-1 gap-[12px] sm:grid-cols-2">
        <SheetKpi label="Adjusted contract" value={formatCurrency(summary.adjustedContract, currency)} />
        <SheetKpi label="Certified to date" value={formatCurrency(summary.certifiedGrossToDate, currency)} />
        <SheetKpi label="Paid to date" value={formatCurrency(summary.amountPaidToDate, currency)} />
        <SheetKpi label="Retention held" value={formatCurrency(summary.retentionHeld, currency)} />
      </div>

      <SheetDivider className="mt-[23px]" />

      <section aria-label="Settlement statement" className="mt-[26px]">
        <div className="flex items-center gap-[10px]">
          <SheetHeading>Settlement Statement</SheetHeading>
          {!error && isSettled(summary) ? (
            <Badge tone="success" size="sm" className="text-caption-m font-medium">
              Settled
            </Badge>
          ) : null}
        </div>
        <p className="mt-[6px] text-caption-m text-[#737373]">
          How the closing position is reached, from the certificates and the receipts recorded against them.
        </p>
        <div className="mt-[16px]">
          <SettlementStatement summary={summary} />
        </div>
      </section>

      <SheetDivider className="mt-[24px]" />
      <div className="mt-[26px]">
        <ClosingChecklist summary={summary} />
      </div>

      <SheetDivider className="mt-[21px]" />
      <div className="mt-[26px]">
        {ledger.error ? <QueryError error={ledger.error} retry={ledger.refetch} noun="funding activity" /> : null}
        {ledger.isPending ? (
          <div role="status" aria-label="Loading funding activity">
            <Spinner />
          </div>
        ) : null}
        {ledger.data ? (
          <PaymentLedgerTable
            entries={ledger.data.ledger}
            currency={currency}
            paymentsPath={`/project/${project.id}/finances/budget-invoices?tab=payments`}
          />
        ) : null}
      </div>
    </section>
  );
}

FinalAccountSection.displayName = "FinalAccountSection";
