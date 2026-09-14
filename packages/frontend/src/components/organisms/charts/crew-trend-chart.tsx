import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/molecules/chart-card";

export interface CrewTrendPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  workersPresent: number;
  /** Planned headcount; null when the log did not record one. */
  workersExpected: number | null;
}

interface CrewTrendChartProps {
  points: CrewTrendPoint[];
  isLoading?: boolean;
}

function formatDay(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

const SERIES_LABEL: Record<string, string> = {
  workersPresent: "On site",
  workersExpected: "Planned",
};

export function CrewTrendChart({ points, isLoading }: CrewTrendChartProps) {
  const hasPlanned = points.some((p) => p.workersExpected !== null && p.workersExpected > 0);
  const isEmpty = points.every((p) => p.workersPresent === 0 && !p.workersExpected);

  return (
    <ChartCard
      title="Crew on site"
      subtitle="Workers present per logged day, last 14 days"
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyLabel="No crew numbers logged in the last 14 days"
      className="border-none bg-transparent p-0 shadow-none"
      contentClassName="h-[160px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fontSize: 11, fill: "#6B7280" }}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelFormatter={(val) => formatDay(String(val))}
            formatter={(value, name) => [String(value ?? 0), SERIES_LABEL[String(name)] ?? String(name)]}
          />
          <Bar dataKey="workersPresent" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          {hasPlanned ? (
            <Line
              type="monotone"
              dataKey="workersExpected"
              stroke="#9CA3AF"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

CrewTrendChart.displayName = "CrewTrendChart";
