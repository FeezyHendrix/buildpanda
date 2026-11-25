import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import type { TransactionAnalytics } from "@/lib/project-types";
import { ChartWell, ExpensePanel } from "./expense-panel";

const TOOLTIP_STYLE = {
  borderRadius: 0,
  border: "1px solid #EEEEEE",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  fontSize: 12,
} as const;

const AXIS_TICK = { fontSize: 12, fill: "#525252" } as const;
const FALLBACK_COLOR = "#6B7280";
const TICK_INTERVALS = 4;

/** The smallest 1/2/2.5/5 × 10ⁿ step whose four intervals cover `max`, so the axis ends on a round figure. */
function niceAxisTicks(max: number): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1, 2, 3, 4];
  const rough = max / TICK_INTERVALS;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? rough;
  return Array.from({ length: TICK_INTERVALS + 1 }, (_, i) => step * i);
}

interface ExpenseChartsProps {
  analytics: TransactionAnalytics | undefined;
  currency: string;
  isLoading: boolean;
}

function CategoryDonut({ analytics, currency, isLoading }: ExpenseChartsProps) {
  const data = useMemo(
    () => (analytics?.byCategory ?? []).map((c) => ({ name: c.label, value: c.total, color: c.color || FALLBACK_COLOR })),
    [analytics],
  );
  return (
    <ExpensePanel title="Spend by Category">
      <ChartWell isLoading={isLoading} isEmpty={data.length === 0} emptyLabel="No spend recorded yet">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie data={data} dataKey="value" cy={163} innerRadius={86} outerRadius={137} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value: unknown) => formatCurrency(Number(value), currency)} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartWell>
    </ExpensePanel>
  );
}

function MonthlyBars({ analytics, currency, isLoading }: ExpenseChartsProps) {
  const data = useMemo(() => (analytics?.byMonth ?? []).map((m) => ({ name: m.month, total: m.total })), [analytics]);
  const ticks = useMemo(() => niceAxisTicks(Math.max(0, ...data.map((m) => m.total))), [data]);
  return (
    <ExpensePanel title="Monthly Spend">
      <ChartWell isLoading={isLoading} isEmpty={data.length === 0} emptyLabel="No monthly spend yet">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 21, right: 12, bottom: 24, left: 12 }}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#737373" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} height={33} tickMargin={15} />
            <YAxis
              width={56}
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              tickMargin={6}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1] ?? 1]}
              tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
            />
            <RechartsTooltip
              formatter={(value: unknown) => formatCurrency(Number(value), currency)}
              cursor={{ fill: "#F6F6F6" }}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar dataKey="total" fill="#004DE7" maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWell>
    </ExpensePanel>
  );
}

export function ExpenseCharts(props: ExpenseChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-2">
      <CategoryDonut {...props} />
      <MonthlyBars {...props} />
    </div>
  );
}

ExpenseCharts.displayName = "ExpenseCharts";
