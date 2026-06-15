import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartCard } from "@/components/molecules/chart-card";
import { formatCurrency, formatWholeCurrency } from "@/lib/formatters";
import type { CashFlowPoint } from "@/hooks/use-reporting-snapshot";

interface CashFlowSCurveProps {
  points: CashFlowPoint[];
  programmeCurve?: CashFlowPoint[] | null;
  currency: string;
  isLoading?: boolean;
}

interface MergedPoint {
  period: string;
  formattedPeriod: string;
  cumulativePlanned?: number;
  cumulativeActual?: number;
  programmePlanned?: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatPeriod(period: string) {
  if (!period) return "";
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  return `${MONTHS[parseInt(month, 10) - 1]} '${year.slice(2)}`;
}

export function CashFlowSCurve({
  points,
  programmeCurve,
  currency,
  isLoading,
}: CashFlowSCurveProps) {
  const chartData = useMemo(() => {
    const merged = new Map<string, MergedPoint>();

    for (const p of points) {
      merged.set(p.period, {
        period: p.period,
        formattedPeriod: formatPeriod(p.period),
        cumulativePlanned: p.cumulativePlanned,
        cumulativeActual: p.cumulativeActual,
      });
    }

    if (programmeCurve) {
      for (const p of programmeCurve) {
        const existing = merged.get(p.period) || {
          period: p.period,
          formattedPeriod: formatPeriod(p.period),
        };
        existing.programmePlanned = p.cumulativePlanned;
        merged.set(p.period, existing);
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [points, programmeCurve]);

  const isEmpty = chartData.length === 0;

  return (
    <ChartCard title="Cash Flow (S-Curve)" isLoading={isLoading} isEmpty={isEmpty}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="formattedPeriod"
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
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            formatter={(value, name) => {
              const label =
                name === "cumulativePlanned" ? "Planned" :
                name === "cumulativeActual" ? "Actual" :
                name === "programmePlanned" ? "Planned (programme)" : String(name);
              return [formatCurrency(Number(value), currency), label];
            }}
            labelStyle={{ color: "#374151", fontWeight: 600, marginBottom: "4px" }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "13px", paddingTop: "20px" }}
            formatter={(value: string) => {
              if (value === "cumulativePlanned") return "Planned";
              if (value === "cumulativeActual") return "Actual";
              if (value === "programmePlanned") return "Planned (programme)";
              return value;
            }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeActual"
            stroke="#10B981"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativePlanned"
            stroke="#3B82F6"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
          />
          {programmeCurve && (
            <Line
              type="monotone"
              dataKey="programmePlanned"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
