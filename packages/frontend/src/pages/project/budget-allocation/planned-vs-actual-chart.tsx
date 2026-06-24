import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  useIsTooltipActive,
  useActiveTooltipLabel,
  useActiveTooltipDataPoints,
} from "recharts";
import { ReactSVG } from "react-svg";

import { Card } from "@/components/atoms/card";
import { icons } from "@/assets/icons/icons";
import { formatCurrency } from "@/lib/formatters";
import type { BudgetPhase, ProjectFinances } from "@/lib/project-types";
import { VarianceTable } from "./variance-table";

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

export function PlannedVsActualChart({
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
        <div className="mx-16">
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
