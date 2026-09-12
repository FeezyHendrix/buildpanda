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
import { financeTabPath } from "@/lib/finance-routes";
import { canResourceAction, type MilestonePayment } from "@/lib/project-types";
import { StagePaymentDialogs } from "./payments/stage-payment-dialogs";
import { ClaimFunnelCard } from "./finances/claim-funnel-card";
import { FundingTrailCard } from "./finances/funding-trail-card";
import { MoneyStrip } from "./finances/money-strip";
import { SettlementStatement, computeSettlement } from "./finances/settlement-statement";

/**
 * Finance overview: the contract waterfall, the money position, where each
 * stage sits in the claim funnel, and the funding trail. Everything shown is a
 * recorded figure — BuildPanda logs money that moved off-platform, never moves it.
 */
export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canDispute = canManage || canResourceAction(access, "finances", "dispute");
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const [cfOpen, setCfOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);
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
  const contractHref = `/project/${project.id}/${financeTabPath("finances/contract")}`;

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
            <h3 className="text-[13px] font-semibold text-black-300">Contract</h3>
            <p className="mt-1 text-xs text-gray-500">
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
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500">
          <span>Recorded figures — set the contract sum and terms on the Contract page.</span>
          <Link to={contractHref} className="font-semibold text-[#004DE7] hover:underline">
            Open Contract ›
          </Link>
        </div>
      </Card>

      <MoneyStrip projectId={project.id} finances={finances} settlement={settlement} currency={currency} />

      <ClaimFunnelCard
        projectId={project.id}
        milestones={finances.milestones}
        currency={currency}
        onRequestRelease={canManage ? setReleaseTarget : undefined}
        onRequestDispute={canDispute ? setDisputeTarget : undefined}
      />

      <FundingTrailCard projectId={project.id} currency={currency} />

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

      <StagePaymentDialogs
        projectId={project.id}
        currency={currency}
        releaseTarget={releaseTarget}
        disputeTarget={disputeTarget}
        onReleaseClose={() => setReleaseTarget(null)}
        onDisputeClose={() => setDisputeTarget(null)}
      />
    </div>
  );
}
