import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/molecules/chart-card";
import { formatCurrency } from "@/lib/formatters";
import type { TransactionAnalytics } from "@/lib/project-types";

const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
} as const;

export function ExpenseCharts({
  analytics,
  currency,
  isLoading,
}: {
  analytics: TransactionAnalytics | undefined;
  currency: string;
  isLoading: boolean;
}) {
  const pieData = useMemo(
    () =>
      (analytics?.byCategory ?? []).map((c) => ({
        name: c.label,
        value: c.total,
        color: c.color || "#6B7280",
      })),
    [analytics],
  );

  const barData = useMemo(
    () => (analytics?.byMonth ?? []).map((m) => ({ name: m.month, total: m.total })),
    [analytics],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-h-[280px]">
        <ChartCard title="Spend by Category" isLoading={isLoading} isEmpty={pieData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(val: unknown) => formatCurrency(Number(val), currency)}
                contentStyle={TOOLTIP_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="min-h-[280px]">
        <ChartCard title="Monthly Spend" isLoading={isLoading} isEmpty={barData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6B7280" }} dy={10} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6B7280" }}
                tickFormatter={(val) => formatCurrency(val, currency, { compact: true })}
              />
              <RechartsTooltip
                formatter={(val: unknown) => formatCurrency(Number(val), currency)}
                cursor={{ fill: "#F3F4F6" }}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="total" fill="#004DE7" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

ExpenseCharts.displayName = "ExpenseCharts";
