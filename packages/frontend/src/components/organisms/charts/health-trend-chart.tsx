import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from "recharts";
import type { HealthPoint } from "@/hooks/use-reporting-snapshot";

interface HealthTrendChartProps {
  points: HealthPoint[];
  compact?: boolean;
}

function formatDate(isoString: string, includeYear: boolean = false) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (includeYear) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

export function HealthTrendChart({ points, compact = false }: HealthTrendChartProps) {
  if (points.length < 2) {
    return compact ? null : (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
        <p className="text-sm text-gray-500">Not enough data for a trend.</p>
      </div>
    );
  }

  const latestScore = points[points.length - 1]!.score;
  const color =
    latestScore >= 80 ? "#16A34A" : latestScore >= 50 ? "#D97706" : "#DC2626";

  if (compact) {
    return (
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <YAxis domain={[0, 100]} hide />
            <Line
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="at"
            tickFormatter={(val) => formatDate(val)}
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelFormatter={(val) => formatDate(val as string, true)}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 0, fill: color }}
            activeDot={{ r: 6, strokeWidth: 0, fill: color }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
