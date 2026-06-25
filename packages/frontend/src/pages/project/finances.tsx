import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";

import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { FundProjectDialog } from "@/components/molecules/fund-project-dialog";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useFundProject,
  useProjectFinances,
  useRaiseDispute,
  useReleaseMilestone,
} from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import type { MilestonePayment } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { BudgetAllocationCard } from "./finances/budget-allocation-card";
import { MaterialsProcurementCard } from "./finances/materials-procurement-card";
import { MilestonePaymentsCard } from "./finances/milestone-payments-card";

export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const canDispute = canManage || access?.relationship === "client";
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const [fundOpen, setFundOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(
    null,
  );
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(
    null,
  );

  const fundProject = useFundProject();
  const releaseMilestone = useReleaseMilestone();
  const raiseDispute = useRaiseDispute();

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!finances) {
    return (
      <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
        <PageHeader
          title="Finances"
          description="Track spending, control payments, and monitor budget transparency across all phases."
        />
        <Card padding="lg" className="mt-8 text-center text-sm text-gray-500">
          No finance data yet for this project.
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 lg:px-6 py-8 sm:px-10">
      <PageHeader
        title="Finances"
        description="Track spending, control payments, and monitor budget transparency across all phases."
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setFundOpen(true)}
                className="cursor-pointer"
              >
                <ReactSVG src={icons.plusCircle} />
                Fund Project
              </Button>
            </div>
          ) : undefined
        }
      />

      <section
        aria-label="Finance summary"
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <KpiCard
          title="Total Budget"
          icon={icons.moneyBag}
          value={formatCurrency(finances.totalBudget, finances.currency)}
          className="rounded-tl-[16px] rounded-tr-[1px] rounded-br-[1px] rounded-bl-[16px]"
        />
        <KpiCard
          title="Funds Deposited"
          icon={icons.money}
          value={formatCurrency(finances.fundsDeposited, finances.currency)}
        />
        <KpiCard
          title="Funds Released"
          icon={icons.hand}
          value={formatCurrency(finances.fundsReleased, finances.currency)}
        />
        <KpiCard
          title="Locked In Escrow"
          icon={icons.safeSquare}
          value={formatCurrency(finances.lockedInEscrow, finances.currency)}
        />
        <KpiCard
          title="Remaining Balance"
          icon={icons.wallet}
          value={formatCurrency(finances.remainingBalance, finances.currency)}
        />
        {snapshot?.finance?.invoices ? (
          <KpiCard
            title="Retention Held"
            icon={icons.safeSquare}
            value={formatCurrency(
              snapshot.finance.invoices.retentionHeld,
              finances.currency,
            )}
            className="rounded-tl-[1px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[1px]"
          />
        ) : (
          <div className="rounded-tl-[1px] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[1px]" />
        )}
      </section>

      {snapshot?.finance && (
        <div className="mt-3 flex items-center justify-center gap-4 rounded-xl border border-[#EDEDED] bg-white p-4 text-sm font-medium text-gray-700 shadow-sm">
          <span className="flex items-center gap-2">
            Committed
            <span className="text-gray-900">
              {formatCurrency(
                snapshot.finance.budget.totalCommitted,
                finances.currency,
              )}
            </span>
          </span>
          <span className="text-gray-300">›</span>
          <span className="flex items-center gap-2">
            Invoiced
            <span className="text-gray-900">
              {formatCurrency(
                snapshot.finance.invoices.invoicedTotal,
                finances.currency,
              )}
            </span>
          </span>
          <span className="text-gray-300">›</span>
          <span className="flex items-center gap-2">
            Paid
            <span className="text-gray-900">
              {formatCurrency(
                snapshot.finance.invoices.paidTotal,
                finances.currency,
              )}
            </span>
          </span>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <BudgetAllocationCard
          projectId={project.id}
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="w-full lg:w-[60%] rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
        <MaterialsProcurementCard
          projectId={project.id}
          materials={finances.materialsProcured}
          currency={finances.currency}
          className="w-full lg:w-[40%] rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
      </div>

      <div className="mt-6">
        {/* <AiInsightsCard insights={INSIGHTS} className="lg:col-span-1" /> */}
        <MilestonePaymentsCard
          projectId={project.id}
          milestones={finances.milestones}
          currency={finances.currency}
          onRequestRelease={canManage ? setReleaseTarget : undefined}
          onRequestDispute={canDispute ? setDisputeTarget : undefined}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
      </div>

      <FundProjectDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
        currency={finances.currency}
        isSubmitting={fundProject.isPending}
        error={fundProject.error ? (fundProject.error as Error).message : null}
        onSubmit={(input) => {
          fundProject.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setFundOpen(false) },
          );
        }}
      />

      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReleaseTarget(null);
        }}
        title={`Release ${releaseTarget?.name ?? "milestone"} funds?`}
        description={`${
          releaseTarget
            ? formatCurrency(releaseTarget.amount, finances.currency)
            : ""
        } will be released from escrow to the contractor.`}
        confirmLabel="Release funds"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!releaseTarget) return;
          releaseMilestone.mutate(
            { projectId: project.id, milestoneId: releaseTarget.id },
            { onSettled: () => setReleaseTarget(null) },
          );
        }}
      />

      <RaiseDisputeDialog
        open={disputeTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDisputeTarget(null);
        }}
        milestoneName={disputeTarget?.name ?? ""}
        isSubmitting={raiseDispute.isPending}
        error={
          raiseDispute.error ? (raiseDispute.error as Error).message : null
        }
        onSubmit={({ reason }) => {
          if (!disputeTarget) return;
          raiseDispute.mutate(
            { projectId: project.id, milestoneId: disputeTarget.id, reason },
            { onSuccess: () => setDisputeTarget(null) },
          );
        }}
      />
    </div>
  );
}
