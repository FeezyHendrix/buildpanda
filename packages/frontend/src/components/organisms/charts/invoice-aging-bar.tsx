import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard } from "@/components/molecules/chart-card";
import { formatCurrency, formatWholeCurrency } from "@/lib/formatters";
import type { InvoiceAgingBuckets } from "@/hooks/use-reporting-snapshot";

interface InvoiceAgingBarProps {
  aging: InvoiceAgingBuckets;
  currency: string;
  isLoading?: boolean;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { value: number }[];
  currency: string;
}

const CustomTooltip = ({ active, payload, label, currency }: TooltipProps) => {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  return (
    <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg">
      <p className="font-semibold text-gray-900 mb-1">{label}</p>
      <p className="font-medium text-gray-900">
        {formatCurrency(entry.value, currency)}
      </p>
    </div>
  );
};

export function InvoiceAgingBar({
  aging,
  currency,
  isLoading,
}: InvoiceAgingBarProps) {
  const chartData = useMemo(() => {
    if (!aging) return [];
    return [
      { name: "Current", value: aging.current, fill: "#93C5FD" },
      { name: "30-60 Days", value: aging.thirtyToSixty, fill: "#FBBF24" },
      { name: "60-90 Days", value: aging.sixtyToNinety, fill: "#F97316" },
      { name: ">90 Days", value: aging.overNinety, fill: "#EF4444" },
    ];
  }, [aging]);

  const isEmpty = chartData.length === 0 || chartData.every(d => d.value === 0);

  

  return (
    <ChartCard title="Invoice Aging" isLoading={isLoading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            tickFormatter={(val) => formatWholeCurrency(val, currency)}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ fill: "#F3F4F6" }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
