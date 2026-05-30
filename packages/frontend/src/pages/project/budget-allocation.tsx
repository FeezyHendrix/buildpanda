import { useMemo } from "react";
import { Card } from "@/components/atoms/card";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectFinances } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  BudgetPhase,
  ProjectFinances,
} from "@/lib/project-mock-data";

const DONUT_COLORS = [
  "#004DE7",
  "#1B8E45",
  "#C26A00",
  "#5A3DD0",
  "#D8741F",
  "#C72525",
] as const;

const DONUT_RADIUS = 70;
const DONUT_STROKE = 18;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export default function ProjectBudgetAllocation() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);

  if (isPending || !finances) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#004DE7]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <Breadcrumbs
        items={[
          { label: "Finances", to: `/project/${project.id}/finances` },
          { label: "Budget Allocation & Analysis" },
        ]}
        className="mb-4"
      />
      <PageHeader
        title="Budget Allocation & Analysis"
        description="Detailed phase-by-phase planned vs actual breakdown with variance tracking."
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <AllocationBreakdown
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="lg:col-span-2"
        />
        <PlannedVsActualChart
          allocation={finances.budgetAllocation}
          className="lg:col-span-3"
        />
      </div>

      <VarianceTable
        allocation={finances.budgetAllocation}
        currency={finances.currency}
        className="mt-6"
      />
    </div>
  );
}

interface AllocationBreakdownProps {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
}

function AllocationBreakdown({
  allocation,
  currency,
  className,
}: AllocationBreakdownProps) {
  const totalPlanned = useMemo(
    () => allocation.reduce((sum, phase) => sum + phase.planned, 0),
    [allocation],
  );

  const segments = useMemo(
    () =>
      allocation.map((phase, idx) => ({
        id: phase.id,
        label: phase.name,
        value: phase.planned,
        color: DONUT_COLORS[idx % DONUT_COLORS.length]!,
      })),
    [allocation],
  );

  return (
    <Card padding="lg" className={className}>
      <h2 className="text-base font-semibold text-gray-900">
        Allocation Breakdown
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Share of total planned budget per phase.
      </p>
      <div className="mt-6 flex flex-col items-center gap-6">
        <DonutChart
          segments={segments}
          totalLabel={formatCurrency(totalPlanned, currency)}
          totalSubtitle="Total Planned"
        />
        <ul className="flex w-full flex-col gap-2">
          {allocation.map((phase, idx) => (
            <BreakdownLegendItem
              key={phase.id}
              phase={phase}
              total={totalPlanned}
              color={DONUT_COLORS[idx % DONUT_COLORS.length]!}
            />
          ))}
        </ul>
      </div>
    </Card>
  );
}

function BreakdownLegendItem({
  phase,
  total,
  color,
}: {
  phase: BudgetPhase;
  total: number;
  color: string;
}) {
  const pctOfTotal = total ? ((phase.planned / total) * 100).toFixed(1) : "0.0";
  return (
    <li className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-2 text-gray-700">
        <span
          className="size-2.5 rounded-sm"
          style={{ backgroundColor: color }}
        />
        {phase.name}
      </span>
      <span className="tabular-nums text-gray-500">{pctOfTotal}%</span>
    </li>
  );
}

function PlannedVsActualChart({
  allocation,
  className,
}: {
  allocation: BudgetPhase[];
  className?: string;
}) {
  const maxValue = useMemo(
    () => Math.max(...allocation.flatMap((p) => [p.planned, p.actual]), 1),
    [allocation],
  );

  return (
    <Card padding="lg" className={className}>
      <h2 className="text-base font-semibold text-gray-900">
        Planned vs Actual
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        Spending performance against the plan.
      </p>

      <div className="mb-4 mt-5 flex items-center gap-4 text-xs">
        <LegendSwatch color="bg-[#004DE7]" label="Planned" />
        <LegendSwatch color="bg-[#1B8E45]" label="Actual" />
      </div>

      <div className="flex h-56 items-stretch gap-3 sm:gap-5">
        {allocation.map((phase) => (
          <PhaseBars key={phase.id} phase={phase} maxValue={maxValue} />
        ))}
      </div>
    </Card>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-600">
      <span className={cn("size-2.5 rounded-sm", color)} />
      {label}
    </span>
  );
}

function PhaseBars({
  phase,
  maxValue,
}: {
  phase: BudgetPhase;
  maxValue: number;
}) {
  const plannedH = Math.max(4, (phase.planned / maxValue) * 100);
  const actualH = Math.max(2, (phase.actual / maxValue) * 100);
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <div className="flex w-full flex-1 items-end justify-center gap-1.5">
        <div
          className="w-4 rounded-t-md bg-[#004DE7] sm:w-5"
          style={{ height: `${plannedH}%` }}
        />
        <div
          className="w-4 rounded-t-md bg-[#1B8E45] sm:w-5"
          style={{ height: `${actualH}%` }}
        />
      </div>
      <span className="line-clamp-1 max-w-full text-[10px] text-gray-500">
        {phase.name}
      </span>
    </div>
  );
}

interface VarianceTableProps {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
}

function VarianceTable({
  allocation,
  currency,
  className,
}: VarianceTableProps) {
  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="border-b border-[#EDEDED] bg-[#FAFAFA] px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          Detailed Variance Table
        </h2>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#EDEDED] text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-6 py-3 font-medium">Phase</th>
            <th className="px-6 py-3 text-right font-medium">Planned</th>
            <th className="px-6 py-3 text-right font-medium">Actual Spent</th>
            <th className="px-6 py-3 text-right font-medium">Variance</th>
            <th className="px-6 py-3 text-right font-medium">% Used</th>
          </tr>
        </thead>
        <tbody>
          {allocation.map((phase, idx) => (
            <VarianceRow
              key={phase.id}
              phase={phase}
              currency={currency}
              isLast={idx === allocation.length - 1}
            />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function VarianceRow({
  phase,
  currency,
  isLast,
}: {
  phase: BudgetPhase;
  currency: ProjectFinances["currency"];
  isLast: boolean;
}) {
  const hasActual = phase.actual > 0;
  const variance = phase.actual - phase.planned;
  const isOver = variance > 0;
  const pctUsed = phase.planned
    ? ((phase.actual / phase.planned) * 100).toFixed(1)
    : "—";

  return (
    <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
      <td className="px-6 py-3 font-medium text-gray-900">{phase.name}</td>
      <td className="px-6 py-3 text-right tabular-nums text-gray-700">
        {formatCurrency(phase.planned, currency)}
      </td>
      <td className="px-6 py-3 text-right tabular-nums text-gray-700">
        {hasActual ? formatCurrency(phase.actual, currency) : "—"}
      </td>
      <td
        className={cn(
          "px-6 py-3 text-right font-medium tabular-nums",
          !hasActual
            ? "text-gray-400"
            : isOver
              ? "text-[#C72525]"
              : "text-[#1B8E45]",
        )}
      >
        {!hasActual
          ? "—"
          : `${isOver ? "+" : "−"}${formatCurrency(Math.abs(variance), currency)}`}
      </td>
      <td className="px-6 py-3 text-right tabular-nums text-gray-500">
        {hasActual ? `${pctUsed}%` : "—"}
      </td>
    </tr>
  );
}

interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  totalLabel: string;
  totalSubtitle: string;
}

function DonutChart({ segments, totalLabel, totalSubtitle }: DonutChartProps) {
  const rendered = useMemo(() => {
    const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
    let offset = 0;
    return segments.map((seg) => {
      const length = (seg.value / total) * DONUT_CIRCUMFERENCE;
      const result = {
        id: seg.id,
        color: seg.color,
        length,
        offset,
      };
      offset += length;
      return result;
    });
  }, [segments]);

  return (
    <div className="relative">
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="90"
          cy="90"
          r={DONUT_RADIUS}
          fill="none"
          stroke="#F0F0F0"
          strokeWidth={DONUT_STROKE}
        />
        {rendered.map((seg) => (
          <circle
            key={seg.id}
            cx="90"
            cy="90"
            r={DONUT_RADIUS}
            fill="none"
            stroke={seg.color}
            strokeWidth={DONUT_STROKE}
            strokeDasharray={`${seg.length} ${DONUT_CIRCUMFERENCE}`}
            strokeDashoffset={-seg.offset}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-base font-bold tabular-nums text-gray-900">
          {totalLabel}
        </p>
        <p className="text-[11px] text-gray-500">{totalSubtitle}</p>
      </div>
    </div>
  );
}
