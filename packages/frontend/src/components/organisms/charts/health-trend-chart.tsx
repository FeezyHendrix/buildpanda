import { CartesianGrid, LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from "recharts";
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

const Y_TICKS = [0, 25, 50, 75, 100];
const AXIS_TICK = { fill: "#4D4D4D", fontSize: 12 };

/** "Sep 07": every point is labelled, so the day is zero-padded to keep the labels even. */
function formatTick(isoString: string) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
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
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#6B6B6B" />
          <XAxis
            dataKey="at"
            tickFormatter={formatTick}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            height={50}
            tickMargin={17}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={Y_TICKS}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelFormatter={(val) => formatDate(val as string, true)}
          />
          <Line
            type="linear"
            dataKey="score"
            stroke="#004DE7"
            strokeWidth={4}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0, fill: "#004DE7" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
