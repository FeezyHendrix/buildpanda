import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { CrewTrendChart, type CrewTrendPoint } from "@/components/organisms/charts/crew-trend-chart";
import { useDailyLogCoverage, useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { cn } from "@/lib/utils";
import { describeWorkingWeek } from "@/lib/working-calendar";
import type { DailyLogDay } from "@/lib/project-types";

const WINDOW_DAYS = 14;

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
  averageCrew: number | null;
  points: CrewTrendPoint[];
}

/**
 * The crew trend over the window. Missed days are deliberately NOT counted here
 * — that figure belongs to the project's own working calendar, not to a
 * fortnight and a guess at which days are weekends, so it is read from
 * /daily-logs/coverage, the same source the daily-log page uses.
 */
function deriveFieldFigures(logs: DailyLogDay[], dates: string[]): FieldFigures {
  const live = new Map(logs.filter((l) => !l.voidedAt).map((l) => [l.logDate.slice(0, 10), l]));
  let crewTotal = 0;
  const points: CrewTrendPoint[] = dates.map((date) => {
    const log = live.get(date);
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
    averageCrew: daysLogged > 0 ? Math.round(crewTotal / daysLogged) : null,
    points,
  };
}

function Figure({
  label,
  value,
  helper,
  danger,
}: {
  label: string;
  value: string;
  helper?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-[12px] text-black-300">{label}</p>
      <p className={cn("text-[22px] font-bold leading-tight tabular-nums", danger ? "text-error-600" : "text-black-500")}>
        {value}
      </p>
      {helper ? <p className="text-[11px] leading-tight text-black-300">{helper}</p> : null}
    </div>
  );
}

export function FieldActivityCard({ projectId, className }: { projectId: string; className?: string }) {
  const today = new Date();
  const dates = windowDates(today);
  const range = { from: dates[0]!, to: dates[dates.length - 1]! };
  const logs = useProjectDailyLogs(projectId, range);
  const { data: coverage } = useDailyLogCoverage(projectId);
  const figures = deriveFieldFigures(logs.data ?? [], dates);
  const workingWeek = describeWorkingWeek(coverage?.calendar.workingDays);

  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <h3 className="text-[13px] font-semibold text-black-300">Field activity</h3>
        </div>
        <Link
          to={`/project/${projectId}/schedules/daily-log`}
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
              <Figure label="Days logged" value={`${figures.daysLogged} of ${WINDOW_DAYS}`} helper="last 14 days" />
              <Figure
                label="Working days missed"
                value={coverage ? String(coverage.daysMissed) : "—"}
                helper={workingWeek ? `${workingWeek}, since work started` : "since work started"}
                danger={Boolean(coverage && coverage.daysMissed > 0)}
              />
              <Figure
                label="Average crew"
                value={figures.averageCrew === null ? "—" : String(figures.averageCrew)}
                helper="per logged day"
              />
            </div>
            <CrewTrendChart points={figures.points} />
          </div>
        )}
      </div>
    </Card>
  );
}

FieldActivityCard.displayName = "FieldActivityCard";
