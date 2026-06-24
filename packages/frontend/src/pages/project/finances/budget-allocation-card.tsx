import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  useIsTooltipActive, useActiveTooltipLabel, useActiveTooltipDataPoints } from "recharts";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Card } from "@/components/atoms/card";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { BudgetPhase, ProjectFinances as ProjectFinancesData } from "@/lib/project-types";

const VARIANCE_TABLE_LIMIT = 2;

export interface BudgetAllocationCardProps {
  projectId: string;
  allocation: BudgetPhase[];
  currency: ProjectFinancesData["currency"];
  className?: string;
}

export function BudgetAllocationCard({
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

export function ChartLegend() {
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
export function BudgetTooltip({ currency }: { currency: ProjectFinancesData["currency"] }) {
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

export function VarianceTable({
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

export function VarianceRow({
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

