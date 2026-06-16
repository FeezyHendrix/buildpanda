import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  useActiveTooltipLabel,
  useActiveTooltipDataPoints,
  useIsTooltipActive,
} from "recharts";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectFinances } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type {
  BudgetPhase,
  ProjectFinances,
} from "@/lib/project-types";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";

// ── Segment colours ───────────────────────────────────────────────────────
const DONUT_COLORS = [
  "#0DCFF5",
  "#6DEA62",
  "#F4FB20",
  "#8D62EA",
  "#D8741F",
  "#EA6262",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────
function abbreviateCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000)     return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)         return `₦${(amount / 1_000).toFixed(0)}k`;
  return `₦${amount}`;
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ProjectBudgetAllocation() {
  const { project } = useProjectContext();
  const { data: finances, isPending } = useProjectFinances(project.id);

  if (isPending || !finances) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
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

      <div className="mt-8 flex flex-col gap-5">
        <AllocationBreakdown
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />

        <PlannedVsActualChart
          allocation={finances.budgetAllocation}
          currency={finances.currency}
          className="rounded-[16px] border-none bg-[#F8F8F8] flex flex-col h-full py-0 px-0"
        />
      </div>
    </div>
  );
}

// ── Section 1: Budget allocation donut (Recharts PieChart) ────────────────

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
    () => allocation.reduce((sum, p) => sum + p.planned, 0),
    [allocation],
  );

  const segments = useMemo(
    () =>
      allocation.map((phase, idx) => ({
        id: phase.id,
        name: phase.name,
        value: phase.planned,
        color: DONUT_COLORS[idx % DONUT_COLORS.length]!,
        pct: totalPlanned
          ? Math.round((phase.planned / totalPlanned) * 100)
          : 0,
      })),
    [allocation, totalPlanned],
  );

  return (
    <Card padding="lg" className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.chart} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Budget Allocation by Phase
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        <div className="flex items-center gap-10">

          {/* Donut + center overlay */}
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {segments.map((seg) => (
                    <Cell key={seg.id} fill={seg.color} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 50 }}
                  content={(props: any) => {
                    if (!props.active || !props.payload?.length) return null;
                    const seg = props.payload[0]?.payload as typeof segments[number];
                    return (
                      <div className="rounded-xl bg-white shadow-lg border border-grey-100 px-4 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <p className="text-[13px] font-semibold text-black-500">
                            {seg.name}
                          </p>
                        </div>
                        <p className="text-[12px] text-black-300">
                          {seg.pct}% · {formatCurrency(seg.value, currency)}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered text overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-[18px] font-bold leading-tight text-black-500">
                {abbreviateCurrency(totalPlanned)}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-black-300">
                Total Capital
              </p>
            </div>
          </div>

          {/* 2-column legend */}
          <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4">
            {segments.map((seg) => (
              <div key={seg.id} className="flex items-start gap-2">
                <span
                  className="mt-[3px] size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-black-500">
                    {seg.name}
                  </p>
                  <p className="text-[11px] text-black-300">
                    {seg.pct}% ({formatCurrency(seg.value, currency)})
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </Card>
  );
}

// ── Section 2: Planned vs actual bar chart (Recharts overlapping bars) ────

function PlannedVsActualChart({
  allocation,
  currency,
  className,
}: {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
}) {
  // Per-phase: larger value → behind, smaller value → in front.
  // Colour follows which value (planned vs actual) owns each slot.
  const chartData = useMemo(
    () =>
      allocation.map((item) => ({
        ...item,
        backValue:  Math.max(item.planned, item.actual),
        frontValue: Math.min(item.planned, item.actual),
        backColor:  item.planned >= item.actual ? "#004DE7" : "#B0C8F8",
        frontColor: item.planned <  item.actual ? "#004DE7" : "#B0C8F8",
      })),
    [allocation],
  );

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.noteSpread} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Detailed Phase Allocation
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        <div className='mx-16'>
          {/* Chart legend */}
          <div className="mb-4 flex items-center justify-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-black-300">
              <span className="size-2.5 rounded-full bg-[#004DE7]" /> Planned
            </span>
            <span className="inline-flex items-center gap-1.5 text-black-300">
              <span className="size-2.5 rounded-full bg-[#B0C8F8]" /> Actual
            </span>
          </div>

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
                tick={{ fontSize: 9, fill: "#888888", fontWeight: 600, letterSpacing: 1 }}
                tickFormatter={(v: string) => v.toUpperCase()}
              />
              <Tooltip
                content={<BarTooltip currency={currency} />}
                cursor={{ fill: "#F8F9FF", radius: 6 }}
              />
              {/* Background bar: larger value, renders first = behind */}
              <Bar dataKey="backValue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, idx) => (
                  <Cell key={`back-${idx}`} fill={entry.backColor} />
                ))}
              </Bar>
              {/* Foreground bar: smaller value, renders second = in front */}
              <Bar dataKey="frontValue" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, idx) => (
                  <Cell key={`front-${idx}`} fill={entry.frontColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Variance table sits flush inside the same card */}
        <VarianceTable
          allocation={allocation}
          currency={currency}
          noCard
          className="mt-4"
        />
      </div>
    </Card>
  );
}

// Recharts 3 hook-based tooltip for the bar chart
function BarTooltip({ currency }: { currency: ProjectFinances["currency"] }) {
  const isActive   = useIsTooltipActive();
  const label      = useActiveTooltipLabel();
  const dataPoints = useActiveTooltipDataPoints<{
    planned?: number;
    actual?: number;
  }>();

  if (!isActive || !dataPoints?.length) return null;

  const row     = dataPoints[0];
  const planned = row?.planned ?? 0;
  const actual  = row?.actual  ?? 0;

  return (
    <div className="rounded-xl bg-white shadow-lg border border-grey-100 px-4 py-3 min-w-[180px]">
      <p className="text-[13px] font-semibold text-black-500 mb-3">
        {String(label ?? "")}
      </p>
      <div className="flex flex-col gap-2">
        {(
          [
            { label: "Planned", value: planned, color: "#004DE7" },
            { label: "Actual",  value: actual,  color: "#B0C8F8" },
          ] as const
        ).map((r) => (
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

// ── Section 3: Variance table ─────────────────────────────────────────────

type PhaseStatus = {
  label: string;
  pill: boolean;
  className: string;
};

function getPhaseStatus(phase: BudgetPhase): PhaseStatus {
  if (phase.actual === 0) {
    return { label: "Pending",    pill: true, className: "text-black-100 bg-[#F6F6F6]" };
  }
  const variance = phase.actual - phase.planned;
  const pct      = Math.abs(variance / (phase.planned || 1));

  if (variance <= 0) {
    return {
      label: "On budget",
      pill: true,
      className: "bg-primary-50 text-primary",
    };
  }
  if (pct <= 0.05) {
    return { label: "Completed",    pill: true, className: "bg-[#F6F6F6] text-black-300" };
  }
  return {
    label: "Over budget",
    pill: true,
    className: "bg-error-50 text-error-500",
  };
}

interface VarianceTableProps {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
  /** When true: renders without the outer Card shell (for use inside another card) */
  noCard?: boolean;
}

function VarianceTable({
  allocation,
  currency,
  className,
  noCard = false,
}: VarianceTableProps) {
  const table = (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-[#EDEDED] bg-[#F6F6F6] text-[11px] uppercase tracking-wider text-gray-500">
        <tr>
          <th className="px-6 py-3 font-semibold">Phase</th>
          <th className="px-6 py-3 font-semibold capitalize">Planned</th>
          <th className="px-6 py-3 font-semibold capitalize">Actual Spent</th>
          <th className="px-6 py-3 font-semibold capitalize">Variance</th>
          <th className="px-6 py-3 font-semibold capitalize">Status</th>
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
  );

  if (noCard) {
    return <div className={cn("overflow-x-auto", className)}>{table}</div>;
  }

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <div className="border-b border-[#EDEDED] bg-[#FAFAFA] px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">
          Detailed Variance Table
        </h2>
      </div>
      {table}
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
  const variance  = phase.actual - phase.planned;
  const isOver    = variance > 0;
  const status    = getPhaseStatus(phase);

  return (
    <tr className={isLast ? undefined : "border-b border-[#F0F0F0]"}>
      <td className="px-6 py-3 font-medium text-black-500">{phase.name}</td>
      <td className="px-6 py-3 tabular-nums text-[#131B2E]">
        {formatCurrency(phase.planned, currency)}
      </td>
      <td className="px-6 py-3 tabular-nums text-gray-700">
        {hasActual ? formatCurrency(phase.actual, currency) : "-"}
      </td>
      <td
        className={cn(
          "px-6 py-3 font-medium tabular-nums",
          !hasActual ? "text-gray-400" : isOver ? "text-[#BA1A1A]" : "text-[#0039B1]",
        )}
      >
        {!hasActual
          ? "-"
          : `${isOver ? "+" : "−"}${formatCurrency(Math.abs(variance), currency)}`}
      </td>
      <td className="px-6 py-3">
        <span
          className={cn(
            "text-[11px] font-semibold",
            status.pill && "rounded-full px-2.5 py-0.5",
            status.className,
          )}
        >
          {status.label}
        </span>
      </td>
    </tr>
  );
}
