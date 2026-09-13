/**
 * Shaping the site diary for the assistant.
 *
 * Two things the raw rows do not say on their own, and both produced wrong
 * answers in the dogfood run: a log dated after today is a plan somebody wrote
 * ahead, not a record of work done, and a diary that reports only weather and
 * headcount never says what was actually built. So the shape carries an
 * explicit `isFuture` flag, per-day activity hours, the written entries, and
 * totals already computed over recorded days only.
 */

export interface DiaryLogRow {
  log_date: Date | string;
  weather_condition: string | null;
  temperature_c: string | number | null;
  workers_present: number | null;
  workers_expected: number | null;
  total_hours: string | number | null;
  summary: string | null;
  voided_at: Date | string | null;
}

export interface DiaryActivityHoursRow {
  log_date: Date | string;
  activity_name: string;
  hours_logged: string | number;
}

export interface DiaryEntryRow {
  log_date: Date | string;
  author_name: string;
  author_role: string;
  body_text: string | null;
}

export interface DiaryDay {
  date: string;
  /** Dated after today: a plan, not a record. Never counted in the totals. */
  isFuture: boolean;
  voided: boolean;
  weather: string | null;
  temperatureC: string | number | null;
  workers: string;
  hours: number;
  summary: string | null;
  activities: Array<{ activity: string; hours: number }>;
  entries: Array<{ author: string; role: string; note: string }>;
}

export interface Diary {
  today: string;
  days: DiaryDay[];
  totals: {
    recordedDays: number;
    futureDatedDays: number;
    hours: number;
    note: string;
  };
}

function dayKey(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function groupByDate<Row, Value>(
  rows: readonly Row[],
  dateOf: (row: Row) => Date | string,
  toValue: (row: Row) => Value,
): Map<string, Value[]> {
  const byDate = new Map<string, Value[]>();
  for (const row of rows) {
    const key = dayKey(dateOf(row));
    const list = byDate.get(key) ?? [];
    list.push(toValue(row));
    byDate.set(key, list);
  }
  return byDate;
}

export function shapeDiary(
  logs: readonly DiaryLogRow[],
  activityHours: readonly DiaryActivityHoursRow[],
  entries: readonly DiaryEntryRow[],
  today: string,
): Diary {
  const hoursByDate = groupByDate(
    activityHours,
    (r) => r.log_date,
    (r) => ({ activity: r.activity_name, hours: Number(r.hours_logged) }),
  );
  const entriesByDate = groupByDate(
    entries,
    (r) => r.log_date,
    (r) => ({ author: r.author_name, role: r.author_role, note: r.body_text ?? "" }),
  );

  const days: DiaryDay[] = logs.map((log) => {
    const date = dayKey(log.log_date);
    return {
      date,
      isFuture: date > today,
      voided: Boolean(log.voided_at),
      weather: log.weather_condition,
      temperatureC: log.temperature_c,
      workers: `${log.workers_present ?? "?"}/${log.workers_expected ?? "?"}`,
      hours: Number(log.total_hours ?? 0),
      summary: log.summary,
      activities: hoursByDate.get(date) ?? [],
      entries: entriesByDate.get(date) ?? [],
    };
  });

  const recorded = days.filter((d) => !d.isFuture && !d.voided);
  const hours = recorded.reduce((sum, d) => sum + d.hours, 0);

  return {
    today,
    days,
    totals: {
      recordedDays: recorded.length,
      futureDatedDays: days.filter((d) => d.isFuture).length,
      hours: Math.round(hours * 100) / 100,
      note: "Totals cover recorded days only — future-dated and voided days are excluded.",
    },
  };
}

/** The dates the day-level reads should be batched over. */
export function diaryDates(logs: readonly DiaryLogRow[]): string[] {
  return logs.map((log) => dayKey(log.log_date));
}
