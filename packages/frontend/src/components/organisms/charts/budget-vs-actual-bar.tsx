import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard } from "@/components/molecules/chart-card";
import { formatCurrency, formatWholeCurrency } from "@/lib/formatters";
import type { BudgetCategoryPoint } from "@/hooks/use-reporting-snapshot";

interface BudgetVsActualBarProps {
  categories: BudgetCategoryPoint[];
  currency: string;
  isLoading?: boolean;
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { payload: BudgetCategoryPoint }[];
  currency: string;
}

const CustomTooltip = ({ active, payload, label, currency }: TooltipProps) => {
    const data = payload?.[0]?.payload;
    if (active && data) {
      return (
        <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-gray-500">Planned:</span>
              <span className="font-medium text-gray-900">{formatCurrency(data.planned, currency)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-500">Committed:</span>
              <span className="font-medium text-gray-900">{formatCurrency(data.committed, currency)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-500">Actual:</span>
              <span className="font-medium text-gray-900">{formatCurrency(data.actual, currency)}</span>
            </p>
            <p className="flex justify-between gap-4 pt-1 border-t border-gray-100 mt-1">
              <span className="text-gray-500">Variance:</span>
              <span className={`font-medium ${data.variance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {data.variance > 0 ? "+" : ""}{formatCurrency(data.variance, currency)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

export function BudgetVsActualBar({
  categories,
  currency,
  isLoading,
}: BudgetVsActualBarProps) {
  const chartData = useMemo(() => {
    return [...categories].sort((a: BudgetCategoryPoint, b: BudgetCategoryPoint) => b.variance - a.variance);
  }, [categories]);

  const isEmpty = chartData.length === 0;

  const getActualColor = (actual: number, planned: number) => {
    if (actual > planned) return "#EF4444";
    if (actual < planned) return "#10B981";
    return "#9CA3AF";
  };

  return (
    <ChartCard title="Budget vs Actual by Category" isLoading={isLoading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
          <XAxis
            type="number"
            tickFormatter={(val) => formatWholeCurrency(val, currency)}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#4B5563" }}
            width={120}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }}
          />
          <Bar dataKey="planned" name="Planned" fill="#E5E7EB" radius={[0, 4, 4, 0]} />
          <Bar dataKey="actual" name="Actual" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getActualColor(entry.actual, entry.planned)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
