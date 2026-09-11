import type { BadgeTone } from "@/components/atoms/badge";
import type { DailyLogDay, WeatherCondition } from "@/lib/project-types";

export const WEATHER_TONE: Record<WeatherCondition, BadgeTone> = {
  Sunny: "warning",
  Cloudy: "neutral",
  Rain: "info",
  Storm: "danger",
  Fog: "neutral",
  ExtremeHeat: "danger",
};

export const WEATHER_LABEL: Record<WeatherCondition, string> = {
  Sunny: "Sunny",
  Cloudy: "Cloudy",
  Rain: "Rain",
  Storm: "Storm",
  Fog: "Fog",
  ExtremeHeat: "Extreme heat",
};

export const ROW_FILTERS = [
  { value: "all", label: "All" },
  { value: "logged", label: "Logged" },
  { value: "missed", label: "Missed" },
  { value: "voided", label: "Voided" },
] as const;

export type RowFilter = (typeof ROW_FILTERS)[number]["value"];

/** One row per project-day: a real log, or a synthetic "missed" day with no log. */
export interface DailyLogRow {
  logDate: string;
  day: DailyLogDay | null;
  missed: boolean;
  voided: boolean;
  /** One author, "Team" when several people logged, null when nobody has. */
  loggedBy: string | null;
  activityHours: number;
}

export interface DailyLogKpis {
  daysLogged: number;
  missedDays: number;
  totalHours: number;
  averageCrew: number | null;
}

const DEFAULT_RANGE_DAYS = 30;

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function defaultDateRange(): { from: string; to: string } {
  const to = todayIso();
  return { from: addDays(to, -DEFAULT_RANGE_DAYS), to };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && ISO_DATE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()));
}

/** "11 Sep 2026" */
export function formatDayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "Friday" */
export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

/** "11 Sep, 14:05" for entry timestamps. */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function loggedByLabel(day: DailyLogDay): string | null {
  const names = new Set(day.entries.filter((e) => !e.voided).map((e) => e.authorName));
  if (names.size === 0) return null;
  if (names.size === 1) return [...names][0]!;
  return "Team";
}

export function activityHours(day: DailyLogDay): number {
  return day.activities.reduce((sum, a) => sum + a.hoursLogged, 0);
}

function toRow(day: DailyLogDay): DailyLogRow {
  return {
    logDate: day.logDate,
    day,
    missed: false,
    voided: Boolean(day.voidedAt),
    loggedBy: loggedByLabel(day),
    activityHours: activityHours(day),
  };
}

function missedRow(logDate: string): DailyLogRow {
  return { logDate, day: null, missed: true, voided: false, loggedBy: null, activityHours: 0 };
}

/**
 * One row per calendar day from the earliest loaded log up to today (or the
 * range end, whichever is earlier). Days with no log become "missed" rows.
 * Newest first.
 */
export function buildRows(days: readonly DailyLogDay[], today: string, rangeTo: string): DailyLogRow[] {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.logDate, d]));
  let earliest = days[0]!.logDate;
  for (const d of days) if (d.logDate < earliest) earliest = d.logDate;
  const end = rangeTo && rangeTo < today ? rangeTo : today;

  const rows: DailyLogRow[] = [];
  for (let cursor = end; cursor >= earliest; cursor = addDays(cursor, -1)) {
    const day = byDate.get(cursor);
    rows.push(day ? toRow(day) : missedRow(cursor));
  }
  // Logs dated after `end` (a future-dated entry) still belong in the grid.
  for (const d of days) if (d.logDate > end) rows.unshift(toRow(d));
  return rows;
}

function matchesQuery(row: DailyLogRow, term: string): boolean {
  if (!row.day) return false;
  const haystack = row.day.entries
    .flatMap((e) => [e.authorName, e.bodyText ?? ""])
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function matchesFilter(row: DailyLogRow, filter: RowFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "logged":
      return !row.missed && !row.voided;
    case "missed":
      return row.missed;
    case "voided":
      return row.voided;
  }
}

export function filterRows(rows: readonly DailyLogRow[], filter: RowFilter, query: string): DailyLogRow[] {
  const term = query.trim().toLowerCase();
  return rows.filter((row) => matchesFilter(row, filter) && (term.length === 0 || matchesQuery(row, term)));
}

export function computeKpis(rows: readonly DailyLogRow[]): DailyLogKpis {
  let daysLogged = 0;
  let missedDays = 0;
  let totalHours = 0;
  let crewSum = 0;
  for (const row of rows) {
    if (row.missed) {
      missedDays += 1;
      continue;
    }
    daysLogged += 1;
    totalHours += row.day!.totalHours;
    crewSum += row.day!.workersPresent;
  }
  return {
    daysLogged,
    missedDays,
    totalHours,
    averageCrew: daysLogged > 0 ? Math.round((crewSum / daysLogged) * 10) / 10 : null,
  };
}
