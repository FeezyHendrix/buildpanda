import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";

import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { AddCashFlowDialog } from "@/components/molecules/add-cash-flow-dialog";
import { KpiCard } from "@/components/molecules/kpi-card";
import { PageHeader } from "@/components/molecules/page-header";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useAddCashFlowEntry,
  useCashFlowEntries,
  useProjectFinances,
  useRaiseDispute,
  useReleaseMilestone,
} from "@/hooks/use-finances";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { CashFlowEntry, MilestonePayment } from "@/lib/project-types";
import { canResourceAction } from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { BudgetAllocationCard } from "./finances/budget-allocation-card";
import { ContractOverviewCard } from "./finances/contract-overview-card";
import { MaterialsProcurementCard } from "./finances/materials-procurement-card";
import { MilestonePaymentsCard } from "./finances/milestone-payments-card";
import { FundingTrailCard } from "./finances/funding-trail-card";
import { BillingAuditCard } from "./finances/billing-audit-card";

function CashFlowChronology({
  entries,
  currency,
}: {
  entries: CashFlowEntry[];
  currency: string;
}) {
  const valuations = useMemo(
    () => entries.filter((e) => e.category === "valuation"),
    [entries],
  );
  const milestones = useMemo(
    () => entries.filter((e) => e.category === "milestone_payment"),
    [entries],
  );
  const claims = useMemo(
    () => entries.filter((e) => e.category === "claims_payment"),
    [entries],
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <ChronologyCard
        title="Valuation"
        entries={valuations}
        accent="bg-blue-500"
        formatAmount={(e) => `+${formatCurrency(e.amount, currency)}`}
        renderExtra={(e) =>
          e.retentionAccrued > 0 ? (
            <p className="text-[11px] text-amber-600">
              Retention: {formatCurrency(e.retentionAccrued, currency)}
            </p>
          ) : null
        }
      />
      <ChronologyCard
        title="Stage payments"
        entries={milestones}
        accent="bg-green-500"
        formatAmount={(e) => formatCurrency(e.amount, currency)}
      />
      <ChronologyCard
        title="Payment requests"
        entries={claims}
        accent="bg-amber-500"
        formatAmount={(e) =>
          e.isCredit
            ? `−${formatCurrency(e.amount, currency)}`
            : `+${formatCurrency(e.amount, currency)}`
        }
        amountClass={(e) => (e.isCredit ? "text-red-600" : "text-green-600")}
      />
    </div>
  );
}

function ChronologyCard({
  title,
  entries,
  accent,
  formatAmount,
  amountClass,
  renderExtra,
}: {
  title: string;
  entries: CashFlowEntry[];
  accent: string;
  formatAmount: (e: CashFlowEntry) => string;
  amountClass?: (e: CashFlowEntry) => string | undefined;
  renderExtra?: (e: CashFlowEntry) => ReactNode;
}) {
  return (
    <Card padding="lg" className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full">
      <h4 className="mb-0 text-sm font-semibold text-gray-900">{title}</h4>
      <p className="mb-4 text-xs text-gray-500">
        {entries.length === 0
          ? "No entries recorded yet."
          : `${entries.length} entries`}
      </p>
      {entries.length > 0 && (
        <div className="relative flex-1">
          <div className="absolute bottom-0 left-[7px] top-0 w-px bg-[#EDEDED]" />
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="relative flex items-start gap-3">
                <div
                  className={`z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ${accent}`}
                />
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900">
                      {entry.description ?? formatShortDate(entry.entryDate)}
                    </p>
                    <span
                      className={`shrink-0 text-xs font-semibold tabular-nums ${
                        amountClass ? amountClass(entry) : "text-gray-900"
                      }`}
                    >
                      {formatAmount(entry)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {formatShortDate(entry.createdAt)}
                    {entry.createdBy ? ` · by ${entry.createdBy.name}` : ""}
                  </p>
                  {renderExtra?.(entry)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = canResourceAction(access, "finances", "manage");
  const canDispute = canManage || canResourceAction(access, "finances", "dispute");
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: cashFlowEntries, isPending: cfPending } = useCashFlowEntries(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const [cfOpen, setCfOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(
    null,
  );
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(
    null,
  );

  const addCashFlow = useAddCashFlowEntry();
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
          title="Finance"
          description="See where the project's money stands — what's budgeted, spent, and still to pay."
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
        title="Finance"
        description="See where the project's money stands — what's budgeted, spent, and still to pay."
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => setCfOpen(true)}
                className="cursor-pointer"
              >
                <ReactSVG src={icons.plusCircle} />
                Record cash flow
              </Button>
            </div>
          ) : undefined
        }
      />

      <ContractOverviewCard
        projectId={project.id}
        contractSum={finances.contractSum}
        variationsTotal={finances.variationsTotal}
        adjustedContract={finances.adjustedContract}
        certifiedGrossToDate={finances.certifiedGrossToDate}
        currency={finances.currency}
        canManage={canManage}
      />

      <section
        aria-label="Finance summary"
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-3"
      >
        <KpiCard
          title="Total Budget"
          icon={icons.moneyBag}
          value={formatCurrency(finances.totalBudget, finances.currency)}
          className="rounded-tl-[16px] rounded-tr-[1px] rounded-br-[1px]"
        />
        <KpiCard
          title="Approved work value"
          icon={icons.verified}
          value={formatCurrency(finances.certifiedGrossToDate, finances.currency)}
        />
        <KpiCard
          title="Remaining work value"
          icon={icons.wallet}
          value={formatCurrency(
            Math.max(0, finances.adjustedContract - finances.certifiedGrossToDate),
            finances.currency,
          )}
          className="rounded-tr-[16px] rounded-bl-[16px]"
        />
        {snapshot?.finance?.invoices ? (
          <KpiCard
            title="Held back"
            icon={icons.safeSquare}
            value={formatCurrency(
              snapshot.finance.invoices.retentionHeld,
              finances.currency,
            )}
            className="rounded-tl-[1px] rounded-br-[16px] rounded-bl-[1px]"
          />
        ) : (
          <div className="rounded-tl-[1px] rounded-br-[16px] rounded-bl-[1px]" />
        )}
      </section>

      {snapshot?.finance && (
        <div className="mt-3 flex flex-col lg:flex-row lg:items-center items-start justify-center gap-4 rounded-xl border border-[#EDEDED] bg-white p-4 text-sm font-medium text-gray-700 shadow-sm">
          <span className="flex items-center gap-2">
            Committed
            <span className="text-gray-900">
              {formatCurrency(
                snapshot.finance.budget.totalCommitted,
                finances.currency,
              )}
            </span>
          </span>
          <span className="hidden lg:block text-gray-300">›</span>
          <span className="flex items-center gap-2">
            Invoiced
            <span className="text-gray-900">
              {formatCurrency(
                snapshot.finance.invoices.invoicedTotal,
                finances.currency,
              )}
            </span>
          </span>
          <span className="hidden lg:block text-gray-300">›</span>
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
        <MilestonePaymentsCard
          projectId={project.id}
          milestones={finances.milestones}
          currency={finances.currency}
          onRequestRelease={canManage ? setReleaseTarget : undefined}
          onRequestDispute={canDispute ? setDisputeTarget : undefined}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
      </div>

      {!cfPending && cashFlowEntries && cashFlowEntries.length > 0 && (
        <CashFlowChronology
          entries={cashFlowEntries}
          currency={finances.currency}
        />
      )}

      <FundingTrailCard projectId={project.id} currency={finances.currency} />

      <BillingAuditCard />

      <AddCashFlowDialog
        open={cfOpen}
        onOpenChange={setCfOpen}
        currency={finances.currency}
        isSubmitting={addCashFlow.isPending}
        error={addCashFlow.error ? (addCashFlow.error as Error).message : null}
        onSubmit={(input) => {
          addCashFlow.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setCfOpen(false) },
          );
        }}
      />

      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReleaseTarget(null);
        }}
        title={`Record payment for ${releaseTarget?.name ?? "this stage"}?`}
        description={`Logs ${
          releaseTarget
            ? formatCurrency(releaseTarget.amount, finances.currency)
            : ""
        } as paid to the contractor. This records a payment made off-platform — BuildPanda does not move money.`}
        confirmLabel="Record payment"
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
