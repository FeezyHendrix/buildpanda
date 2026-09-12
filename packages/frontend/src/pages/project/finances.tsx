import { useState } from "react";
import { Link } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { AddCashFlowDialog } from "@/components/molecules/add-cash-flow-dialog";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useAddCashFlowEntry, useProjectFinances } from "@/hooks/use-finances";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { useProjectContext } from "@/layouts/project-layout";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";
import { canResourceAction } from "@/lib/project-types";
import { FundingTrailCard } from "./finances/funding-trail-card";
import { MoneyStrip } from "./finances/money-strip";
import { ChangeOrdersCard } from "./finances/overview/change-orders-card";
import { PhaseVarianceCard } from "./finances/overview/phase-variance-card";
import { RecentInvoicesCard } from "./finances/overview/recent-invoices-card";
import { SettlementStatement, computeSettlement } from "./finances/settlement-statement";

/**
 * Finance overview — one screen a PM reads top to bottom: the contract
 * waterfall, the money position, the phases drifting from budget, change
 * orders by status, the latest invoices and the funding trail. Everything
 * shown is a recorded figure — BuildPanda logs money that moved off-platform,
 * never moves it.
 */
export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const [cfOpen, setCfOpen] = useState(false);
  const addCashFlow = useAddCashFlowEntry();

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!finances) {
    return (
      <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
        <PageHeader title="Finance" />
        <EmptyState
          icon={<FinancesIcon />}
          title="No finance data yet"
          description="Budget, spend and payment records will appear here once the project's finances are set up."
        />
      </div>
    );
  }

  const currency = finances.currency;
  const settlement = computeSettlement(finances, snapshot?.finance?.invoices?.retentionHeld ?? 0);
  const contractsHref = `/project/${project.id}/${CONTRACTS_PHASES_PATH}`;

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Finance"
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCfOpen(true)}>
              <ReactSVG src={icons.plusCircle} />
              Record cash flow
            </Button>
          ) : undefined
        }
      />

      <Card padding="lg" className="mt-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-muted">Contract</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Contract sum through variations, certification, payment and retention to what is
              still outstanding.
            </p>
          </div>
          {settlement.isSettled ? (
            <Badge tone="success" size="md" className="gap-1.5">
              <span aria-hidden="true">✓</span>
              Settled
            </Badge>
          ) : null}
        </div>
        <SettlementStatement finances={finances} settlement={settlement} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line-hair pt-4 text-xs text-ink-muted">
          <span>Recorded figures — the contract sum and terms live on the main contract.</span>
          <Link to={contractsHref} className="font-semibold text-primary-500 hover:underline">
            Open Contracts & phases ›
          </Link>
        </div>
      </Card>

      <MoneyStrip projectId={project.id} finances={finances} settlement={settlement} currency={currency} />

      <div className="mt-6 flex flex-col gap-6">
        <PhaseVarianceCard projectId={project.id} currency={currency} />
        <ChangeOrdersCard projectId={project.id} />
        <RecentInvoicesCard projectId={project.id} currency={currency} />
        <FundingTrailCard projectId={project.id} currency={currency} />
      </div>

      <AddCashFlowDialog
        open={cfOpen}
        onOpenChange={setCfOpen}
        currency={currency}
        isSubmitting={addCashFlow.isPending}
        error={addCashFlow.error ? (addCashFlow.error as Error).message : null}
        onSubmit={(input) => {
          addCashFlow.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setCfOpen(false) },
          );
        }}
      />
    </div>
  );
}
