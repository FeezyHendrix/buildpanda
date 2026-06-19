import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  useActiveTooltipLabel,
  useActiveTooltipDataPoints,
  useIsTooltipActive,
} from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { FundProjectDialog } from "@/components/molecules/fund-project-dialog";
import { KpiCard } from "@/components/molecules/kpi-card";
import { MilestoneCard } from "@/components/molecules/milestone-card";
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
import { cn } from "@/lib/utils";
import type {
  BudgetPhase,
  MaterialProcurement,
  MilestonePayment,
  ProjectFinances as ProjectFinancesData,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Avatar } from "@/components/atoms/avatar";

const MATERIALS_PREVIEW_LIMIT = 5;
const VARIANCE_TABLE_LIMIT = 2;

export default function ProjectFinances() {
  const { project, access } = useProjectContext();
  const canManage = access?.capabilities?.canManage ?? false;
  const canDispute = canManage || access?.relationship === "client";
  const { data: finances, isPending } = useProjectFinances(project.id);
  const { data: snapshot } = useReportingSnapshot(project.id);

  const [fundOpen, setFundOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<MilestonePayment | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<MilestonePayment | null>(null);

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
      <div className="w-full px-6 py-8 sm:px-10">
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
    <div className="w-full px-6 py-8 sm:px-10">
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
                className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
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
            value={formatCurrency(snapshot.finance.invoices.retentionHeld, finances.currency)}
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
            <span className="text-gray-900">{formatCurrency(snapshot.finance.budget.totalCommitted, finances.currency)}</span>
          </span>
          <span className="text-gray-300">›</span>
          <span className="flex items-center gap-2">
            Invoiced
            <span className="text-gray-900">{formatCurrency(snapshot.finance.invoices.invoicedTotal, finances.currency)}</span>
          </span>
          <span className="text-gray-300">›</span>
          <span className="flex items-center gap-2">
            Paid
            <span className="text-gray-900">{formatCurrency(snapshot.finance.invoices.paidTotal, finances.currency)}</span>
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-6">
        <BudgetAllocationCard
          projectId={project.id}
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="w-[60%] rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
        <MaterialsProcurementCard
          projectId={project.id}
          materials={finances.materialsProcured}
          currency={finances.currency}
          className="w-[40%] rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
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
          releaseTarget ? formatCurrency(releaseTarget.amount, finances.currency) : ""
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
        error={raiseDispute.error ? (raiseDispute.error as Error).message : null}
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


interface BudgetAllocationCardProps {
  projectId: string;
  allocation: BudgetPhase[];
  currency: ProjectFinancesData["currency"];
  className?: string;
}

function BudgetAllocationCard({
  projectId,
  allocation,
  currency,
  className,
}: BudgetAllocationCardProps) {
  const variancePhases = allocation
    .filter((p) => p.actual > 0)
    .slice(0, VARIANCE_TABLE_LIMIT);

  // Per-phase, decide which value is larger (goes behind) and which is smaller (goes in front).
  // The larger bar renders first so the smaller bar can partially cover it from the bottom up,
  // leaving only the excess peeking out at the top — matching the Figma overlap effect exactly.
  const chartData = useMemo(
    () =>
      allocation.map((item) => ({
        ...item,
        backValue: Math.max(item.planned, item.actual),
        frontValue: Math.min(item.planned, item.actual),
        backColor: item.planned >= item.actual ? "#004DE7" : "#B0C8F8",
        frontColor: item.planned < item.actual ? "#004DE7" : "#B0C8F8",
      })),
    [allocation],
  );

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.chart} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Budget Allocation & Analysis
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/finances/budget-allocation`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View More
        </Link>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        {chartData.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-center">
            <p className="text-sm text-gray-500">
              No budget allocation yet. Add budget categories to see planned vs actual by phase.
            </p>
          </div>
        ) : (
          <>
            <ChartLegend />

            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={chartData}
                  barSize={32}
                  barGap={-32}
                  barCategoryGap="30%"
                  margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 9,
                      fill: "#606060",
                      fontWeight: 600,
                      letterSpacing: 1,
                }}
                tickFormatter={(v: string) => v.toUpperCase()}
              />
              <Tooltip
                content={<BudgetTooltip currency={currency} />}
                cursor={{ fill: "#F8F9FF", radius: 6 }}
              />
              {/* Background bar: always the larger value, colour driven by Cell */}
              <Bar dataKey="backValue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, idx) => (
                  <Cell key={`back-${idx}`} fill={entry.backColor} />
                ))}
              </Bar>
              {/* Foreground bar: always the smaller value, colour driven by Cell */}
              <Bar dataKey="frontValue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, idx) => (
                  <Cell key={`front-${idx}`} fill={entry.frontColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

            <VarianceTable phases={variancePhases} currency={currency} />
          </>
        )}
      </div>
    </Card>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center justify-end gap-4 text-xs">
      <span className="inline-flex items-center gap-1.5 text-black-300">
        <span className="size-2.5 rounded-full bg-[#004DE7]" /> Planned
      </span>
      <span className="inline-flex items-center gap-1.5 text-black-300">
        <span className="size-2.5 rounded-full bg-[#B0C8F8]" /> Actual
      </span>
    </div>
  );
}

// Recharts 3 custom tooltip.
// The chart now uses backValue/frontValue — so we read the original planned/actual
// directly from the first data point's payload (the full chartData row).
function BudgetTooltip({ currency }: { currency: ProjectFinancesData["currency"] }) {
  const isActive = useIsTooltipActive();
  const label = useActiveTooltipLabel();
  // useActiveTooltipDataPoints returns the raw chartData rows (not recharts payload wrappers),
  // so planned/actual live directly on each item, not under a .payload property.
  const dataPoints = useActiveTooltipDataPoints<{
    planned?: number;
    actual?: number;
  }>();

  if (!isActive || !dataPoints?.length) return null;

  const row = dataPoints[0];
  const planned = row?.planned ?? 0;
  const actual = row?.actual ?? 0;

  const rows = [
    { label: "Planned", value: planned, color: "#004DE7" },
    { label: "Actual",  value: actual,  color: "#B0C8F8" },
  ];

  return (
    <div className="rounded-xl bg-white shadow-lg border border-grey-100 px-4 py-3 min-w-[180px]">
      <p className="text-[13px] font-semibold text-black-500 mb-3">
        {String(label ?? "")}
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-[12px] text-black-300">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              {r.label}
            </span>
            <span className="text-[12px] font-semibold text-black-500 tabular-nums">
              {formatCurrency(r.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VarianceTable({
  phases,
  currency,
}: {
  phases: BudgetPhase[];
  currency: ProjectFinancesData["currency"];
}) {
  return (
    <table className="mt-6 w-full text-left text-xs">
      <thead className="bg-[#F6F6F6]">
        <tr className="border-b border-[#F0F0F0] text-black-300 font-semibold">
          <th className="py-2 px-3 font-medium text-black-300 font-semibold">Phase</th>
          <th className="py-2 font-medium text-black-300 font-semibold">Planned</th>
          <th className="py-2 text-black-300 font-semibold">Actual</th>
          <th className="py-2 text-black-300 font-semibold">Variance</th>
        </tr>
      </thead>
      <tbody>
        {phases.map((phase) => (
          <VarianceRow key={phase.id} phase={phase} currency={currency} />
        ))}
      </tbody>
    </table>
  );
}

function VarianceRow({
  phase,
  currency,
}: {
  phase: BudgetPhase;
  currency: ProjectFinancesData["currency"];
}) {
  const variance = phase.actual - phase.planned;
  const isOver = variance > 0;
  const pctOff = Math.abs((variance / phase.planned) * 100).toFixed(1);
  return (
    <tr className="border-b border-[#F8F8F8]">
      <td className="py-2.5 px-3 font-semibold text-black-500">{phase.name}</td>
      <td className="py-2.5 tabular-nums text-[#131B2E]">
        {formatCurrency(phase.planned, currency)}
      </td>
      <td className="py-2.5 tabular-nums text-[#131B2E]">
        {formatCurrency(phase.actual, currency)}
      </td>
      <td
        className={cn(
          "py-2.5  font-semibold tabular-nums",
          isOver ? "text-[#C72525]" : "text-[#0039B1]",
        )}
      >
        {isOver ? "+" : "−"}
        {formatCurrency(Math.abs(variance), currency)} ({pctOff}%)
      </td>
    </tr>
  );
}

interface MaterialsProcurementCardProps {
  className: string;
  projectId: string;
  materials: MaterialProcurement[];
  currency: ProjectFinancesData["currency"];
}

function MaterialsProcurementCard({
  className,
  projectId,
  materials,
  currency,
}: MaterialsProcurementCardProps) {
  const preview = materials.slice(0, MATERIALS_PREVIEW_LIMIT);
  return (
    <Card className={`${className}`}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.chart} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Materials Procurement
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/materials`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View More
        </Link>
      </div>
      <div className="bg-white rounded-[12px] h-full m-1 px-6">
        <ul className="flex flex-col">
          {preview.map((material, idx) => (
            <MaterialRow
              key={`${material.id}-${idx}`}
              material={material}
              currency={currency}
            />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function MaterialRow({
  material,
  currency,
}: {
  material: MaterialProcurement;
  currency: ProjectFinancesData["currency"];
}) {
  return (
    <li className="flex gap-3 items-center justify-between border-b border-[#F0F0F0] py-3 last:border-b-0">
      <div className='flex gap-2 items-center'>
        <Avatar
          name={material.name}
          src={''}
          size="md"
          className={cn("h-[62px] w-[62px] rounded-[4px]")}
        />
        <div className="flex flex-col gap-1">
          <p className="truncate text-[13px] font-medium text-black-500">
            {material.name}
          </p>
          <p className="text-[11px] text-black-300">
            {material.purchasedAt} ·{" "}
          </p>
          <div className='flex gap-1 items-center'>
            <ReactSVG src={icons.paperclip} className='mt-1' />
            <a className="text-[#004DE7] hover:underline text-[13px]" href="#">
              {material.receipt}
            </a>
          </div>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
        {formatCurrency(material.amount, currency)}
      </p>
    </li>
  );
}

interface MilestonePaymentsCardProps {
  projectId: string;
  milestones: MilestonePayment[];
  currency: ProjectFinancesData["currency"];
  onRequestRelease?: (milestone: MilestonePayment) => void;
  onRequestDispute?: (milestone: MilestonePayment) => void;
  className?: string;
}

function MilestonePaymentsCard({
  projectId,
  milestones,
  currency,
  onRequestRelease,
  onRequestDispute,
  className,
}: MilestonePaymentsCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.money} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Milestone Payments
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/finances/milestone-payments`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View More
        </Link>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        <div className="flex items-center gap-4 overflow-x-auto">
          {milestones.map((milestone, idx) => (
            <MilestoneCard
              key={`${milestone.id}-${idx}`}
              milestone={milestone}
              currency={currency}
              variant="compact"
              onReleaseFunds={onRequestRelease ? () => onRequestRelease(milestone) : undefined}
              onRaiseDispute={onRequestDispute ? () => onRequestDispute(milestone) : undefined}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
