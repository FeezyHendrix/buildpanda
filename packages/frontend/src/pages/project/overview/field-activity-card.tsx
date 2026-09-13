import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { CrewTrendChart, type CrewTrendPoint } from "@/components/organisms/charts/crew-trend-chart";
import { useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { cn } from "@/lib/utils";
import type { DailyLogDay } from "@/lib/project-types";

const WINDOW_DAYS = 14;
const SUNDAY = 0;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The 14 calendar days ending today, oldest first, as ISO dates. */
function windowDates(today: Date): string[] {
  const dates: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(isoDate(d));
  }
  return dates;
}

interface FieldFigures {
  daysLogged: number;
  daysMissed: number;
  averageCrew: number | null;
  points: CrewTrendPoint[];
}

/** Site crews work Monday to Saturday; a missed day is a working day with no live log. */
function deriveFieldFigures(logs: DailyLogDay[], dates: string[]): FieldFigures {
  const live = new Map(logs.filter((l) => !l.voidedAt).map((l) => [l.logDate.slice(0, 10), l]));
  let daysMissed = 0;
  let crewTotal = 0;
  const points: CrewTrendPoint[] = dates.map((date) => {
    const log = live.get(date);
    if (!log && new Date(`${date}T00:00:00`).getDay() !== SUNDAY) daysMissed += 1;
    if (log) crewTotal += log.workersPresent;
    return {
      date,
      workersPresent: log?.workersPresent ?? 0,
      workersExpected: log && log.workersExpected > 0 ? log.workersExpected : null,
    };
  });
  const daysLogged = dates.filter((d) => live.has(d)).length;
  return {
    daysLogged,
    daysMissed,
    averageCrew: daysLogged > 0 ? Math.round(crewTotal / daysLogged) : null,
    points,
  };
}

function Figure({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-[12px] text-black-300">{label}</p>
      <p className={cn("text-[22px] font-bold leading-tight tabular-nums", danger ? "text-error-600" : "text-black-500")}>
        {value}
      </p>
    </div>
  );
}

export function FieldActivityCard({ projectId, className }: { projectId: string; className?: string }) {
  const today = new Date();
  const dates = windowDates(today);
  const range = { from: dates[0]!, to: dates[dates.length - 1]! };
  const logs = useProjectDailyLogs(projectId, range);
  const figures = deriveFieldFigures(logs.data ?? [], dates);

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <h3 className="text-[13px] font-semibold text-black-300">Field activity</h3>
        </div>
        <Link
          to={`/project/${projectId}/daily-log`}
          className="text-xs font-semibold text-[#004DE7] hover:underline"
        >
          Daily log
        </Link>
      </div>
      <div className="h-full px-5 pb-5">
        {logs.isPending ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : logs.isError ? (
          <EmptyState variant="inline" title="Daily logs unavailable" description="Try again in a moment." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Figure label="Days logged" value={`${figures.daysLogged} of ${WINDOW_DAYS}`} />
              <Figure label="Working days missed" value={String(figures.daysMissed)} danger={figures.daysMissed > 0} />
              <Figure label="Average crew" value={figures.averageCrew === null ? "—" : String(figures.averageCrew)} />
            </div>
            <CrewTrendChart points={figures.points} />
          </div>
        )}
      </div>
    </Card>
  );
}

FieldActivityCard.displayName = "FieldActivityCard";
