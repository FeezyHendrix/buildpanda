import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ReactSVG } from "react-svg";

import { Card } from "@/components/atoms/card";
import { icons } from "@/assets/icons/icons";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import type { BudgetPhase, ProjectFinances } from "@/lib/project-types";

// ── Segment colours ───────────────────────────────────────────────────────
export const DONUT_COLORS = [
  "#0DCFF5",
  "#6DEA62",
  "#F4FB20",
  "#8D62EA",
  "#D8741F",
  "#EA6262",
] as const;

export interface AllocationBreakdownProps {
  allocation: BudgetPhase[];
  currency: ProjectFinances["currency"];
  className?: string;
}

export function AllocationBreakdown({
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
                {formatCompactCurrency(totalPlanned, currency)}
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
