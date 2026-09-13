import type { Knex } from "knex";
import { isoDate, toCalendar, workingDatesBetween } from "../../lib/working-days.ts";
import type { DailyLogsRepository } from "./repository.ts";

export interface DailyLogCoverage {
  /** First day counted: the works start date, or the first log if work started earlier. */
  from: string | null;
  /** Last day counted: yesterday — today is not missed until it is over. */
  to: string | null;
  workingDays: number;
  daysLogged: number;
  daysMissed: number;
  missedDates: string[];
  /** The calendar the count was made on, so the UI can explain the figure. */
  calendar: { workingDays: number[]; holidays: string[] };
}

export interface CoverageDeps {
  repository: DailyLogsRepository;
  projectDates(projectId: string): Promise<
    { start_date: string | null; working_days: unknown; holidays: unknown } | undefined
  >;
  now?(): Date;
}

export function dailyLogCoverageDeps(db: Knex, repository: DailyLogsRepository): CoverageDeps {
  return {
    repository,
    projectDates: (projectId) =>
      db("projects").where({ id: projectId }).select("start_date", "working_days", "holidays").first(),
  };
}

/**
 * How much of the site diary is actually there. A day is "missed" only if it is
 * a working day on the project's own calendar, falls on or after the works
 * started, is in the past, and carries no live (non-voided) log.
 *
 * The old figure counted calendar days from project creation, so a Sunday and
 * the fortnight before site possession both read as "missed" — six missed days
 * on day six of a job that had not started.
 */
export async function dailyLogCoverage(
  deps: CoverageDeps,
  projectId: string,
  buildingId?: string,
): Promise<DailyLogCoverage> {
  const now = deps.now ?? (() => new Date());
  const [project, rows] = await Promise.all([
    deps.projectDates(projectId),
    deps.repository.listByProjectInRange(projectId, undefined, undefined, buildingId),
  ]);
  const calendar = toCalendar(project?.working_days, project?.holidays);
  const empty: DailyLogCoverage = {
    from: null,
    to: null,
    workingDays: 0,
    daysLogged: 0,
    daysMissed: 0,
    missedDates: [],
    calendar: { workingDays: [...calendar.workingDays], holidays: [...calendar.holidays] },
  };

  const logged = new Set(
    rows.filter((row) => !row.voided_at).map((row) => isoDate(row.log_date)),
  );
  const earliestLog = [...logged].sort()[0];
  const start = project?.start_date
    ? (earliestLog && earliestLog < project.start_date ? earliestLog : project.start_date)
    : earliestLog;
  if (!start) return empty;

  // Yesterday: a day is not missed while it is still being worked.
  const yesterday = isoDate(new Date(now().getTime() - 86_400_000));
  if (yesterday < start) return { ...empty, from: start, to: null };

  const dates = workingDatesBetween(`${start}T00:00:00.000Z`, `${yesterday}T00:00:00.000Z`, calendar);
  const missedDates = dates.filter((date) => !logged.has(date));
  return {
    from: start,
    to: yesterday,
    workingDays: dates.length,
    daysLogged: dates.length - missedDates.length,
    daysMissed: missedDates.length,
    missedDates,
    calendar: { workingDays: [...calendar.workingDays], holidays: [...calendar.holidays] },
  };
}
