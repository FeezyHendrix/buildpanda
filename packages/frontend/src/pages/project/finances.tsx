import { useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { CreateButton } from "@/components/molecules/create-button";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { RecordDepositDialog } from "@/components/molecules/record-deposit-dialog";
import { useFinancePosition } from "@/hooks/use-finances";
import { useReportingSnapshot, type CashFlowPoint } from "@/hooks/use-reporting-snapshot";
import { useProjectContext } from "@/layouts/project-layout";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";
import { canResourceAction } from "@/lib/project-types";
import { FundingTrailCard } from "./finances/funding-trail-card";
import { MoneyStrip } from "./finances/money-strip";
import { ChangeOrdersCard } from "./finances/overview/change-orders-card";
import { ContractHealthCard } from "./finances/overview/contract-health-card";
import { ContractPositionCard } from "./finances/overview/contract-position-card";
import { FundingCard } from "./finances/overview/funding-section";
import { LdExposureCard } from "./finances/overview/ld-exposure-card";
import { PhaseSpendCard } from "./finances/overview/phase-spend-card";
import { RecentInvoicesCard } from "./finances/overview/recent-invoices-card";
import { SpendVsBudgetCard } from "./finances/overview/spend-vs-budget-card";

const EMPTY_POINTS: CashFlowPoint[] = [];

/**
 * Finance overview: one screen, one money model, laid out as rows of panels.
 * The KPI strip leads; then spend against budget over time beside phase
 * spend; then the contract position beside contract health; then dates and
 * LDs, change orders and funding; then recent invoices beside the funding
 * trail. The position panels read `GET /projects/:id/finances/summary` and
 * recompute nothing: certification comes from approved receivable
 * certificates, payment from the receipts recorded on them. The spend curve
 * reads the reporting snapshot's cash-flow points. Funding (deposits and
 * milestone releases) is a separate ledger and sits in its own panel.
 *
 * Cost panels (spend vs budget, phase spend) are the contractor's internal
 * position and need `finances:viewCosts`, so a client-side role never sees
 * them.
 */
export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canViewCosts = access?.capabilities?.canViewCosts ?? false;
  const { data: summary, isPending } = useFinancePosition(project.id);
  const snapshot = useReportingSnapshot(canViewCosts ? project.id : undefined);
  const [depositOpen, setDepositOpen] = useState(false);

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="w-full px-4 pb-8 pt-4 sm:px-10 lg:px-6">
        <PageHeader title="Finance" />
        <EmptyState
          icon={<FinancesIcon />}
          title="No finance data yet"
          description="The contract position appears here once the project's contract sum and terms are set up."
        />
      </div>
    );
  }

  const contractsHref = `/project/${project.id}/${CONTRACTS_PHASES_PATH}`;

  return (
    <div className="w-full px-4 pb-8 pt-4 sm:px-10 lg:px-6">
      <PageHeader
        title="Finance"
        description="The contract position, cash and cost of this build, read from certificates, receipts and logged expenses."
        actions={canManage ? <CreateButton onClick={() => setDepositOpen(true)}>Record funding</CreateButton> : undefined}
      />

      <div className="mt-6 flex flex-col gap-4">
        <MoneyStrip projectId={project.id} summary={summary} />

        {canViewCosts ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <SpendVsBudgetCard
              className="lg:col-span-2"
              projectId={project.id}
              currency={summary.currency}
              points={snapshot.data?.finance.cashFlow.points ?? EMPTY_POINTS}
              budgetCurve={snapshot.data?.schedule.programmeCostCurve}
              budgetTotal={snapshot.data?.finance.budget.totalPlanned ?? 0}
              spentTotal={snapshot.data?.finance.budget.totalActual ?? 0}
              isLoading={snapshot.isPending}
            />
            <PhaseSpendCard projectId={project.id} currency={summary.currency} phases={summary.phases} />
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <ContractPositionCard className="lg:col-span-2" summary={summary} contractsHref={contractsHref} />
          <ContractHealthCard summary={summary} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <LdExposureCard summary={summary} contractsHref={contractsHref} />
          <ChangeOrdersCard projectId={project.id} />
          <FundingCard projectId={project.id} currency={summary.currency} funding={summary.funding} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <RecentInvoicesCard className="lg:col-span-2" projectId={project.id} currency={summary.currency} />
          <FundingTrailCard projectId={project.id} currency={summary.currency} />
        </div>
      </div>

      <RecordDepositDialog open={depositOpen} onOpenChange={setDepositOpen} projectId={project.id} currency={summary.currency} />
    </div>
  );
}
