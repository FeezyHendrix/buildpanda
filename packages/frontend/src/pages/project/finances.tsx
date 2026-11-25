import { useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { CreateButton } from "@/components/molecules/create-button";
import { EmptyState } from "@/components/molecules/empty-state";
import { RecordDepositDialog } from "@/components/molecules/record-deposit-dialog";
import { useSetPageTitle } from "@/contexts/page-title-context";
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

/** The wide panel and its narrow neighbour, in the 668 : 424 ratio of the design. */
const TWO_UP_WIDE = "lg:grid-cols-[minmax(0,668fr)_minmax(0,424fr)]";

/**
 * Finance overview: one screen, one money model, laid out as rows of panels.
 * The KPI strip leads; then spend against budget over time beside phase
 * spend; then the contract position beside contract health; then dates and
 * LDs beside change orders; then funding beside its trail; then the recent
 * invoices across the full width. The position panels read `GET /projects/:id/finances/summary` and
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
  useSetPageTitle("Finance", "The contract position, cash and cost of this build, read from certificates, receipts and logged expenses.");
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
      <div className="w-full px-4 pb-8 pt-[24px] sm:px-10 lg:px-[40px]">
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
    <div className="w-full px-4 pb-8 pt-[24px] sm:px-10 lg:px-[40px]">
      {canManage ? (
        <div className="flex justify-end">
          <CreateButton onClick={() => setDepositOpen(true)} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-semibold">
            Record Funding
          </CreateButton>
        </div>
      ) : null}

      <div className={canManage ? "mt-[24px] flex flex-col gap-[24px]" : "flex flex-col gap-[24px]"}>
        <MoneyStrip projectId={project.id} summary={summary} />

        {canViewCosts ? (
          <div className={`grid gap-[24px] ${TWO_UP_WIDE}`}>
            <SpendVsBudgetCard
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

        <div className={`grid gap-[24px] ${TWO_UP_WIDE}`}>
          <ContractPositionCard summary={summary} contractsHref={contractsHref} />
          <ContractHealthCard summary={summary} />
        </div>

        <div className="grid gap-[24px] lg:grid-cols-2">
          <LdExposureCard summary={summary} contractsHref={contractsHref} />
          <ChangeOrdersCard projectId={project.id} />
        </div>

        <div className="grid gap-[24px] lg:grid-cols-2">
          <FundingCard projectId={project.id} currency={summary.currency} funding={summary.funding} />
          <FundingTrailCard projectId={project.id} currency={summary.currency} />
        </div>

        <RecentInvoicesCard projectId={project.id} currency={summary.currency} />
      </div>

      <RecordDepositDialog open={depositOpen} onOpenChange={setDepositOpen} projectId={project.id} currency={summary.currency} />
    </div>
  );
}
