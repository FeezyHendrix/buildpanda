/**
 * The project's working calendar. A programme is measured in working days, not
 * calendar days: a 1-day rain stop on a Saturday pushes Monday's work, and a
 * six-day week is normal on a civils job. The calendar is a project setting
 * (`projects.working_days` / `projects.holidays`), so every duration, cascade
 * and missed-day figure in the app has to read it rather than assume Mon–Fri.
 */

/** 0 = Sunday … 6 = Saturday. Site default is a six-day week (Mon–Sat). */
export const DEFAULT_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5, 6];

export interface WorkingCalendar {
  /** Day-of-week numbers (0 = Sunday … 6 = Saturday) the site works. */
  workingDays: readonly number[];
  /** ISO `yyyy-mm-dd` dates the site is closed (public holidays, shutdowns). */
  holidays: readonly string[];
}

export const DEFAULT_CALENDAR: WorkingCalendar = {
  workingDays: DEFAULT_WORKING_DAYS,
  holidays: [],
};

const DAY_MS = 86_400_000;

function parseDays(value: unknown): readonly number[] {
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!Array.isArray(raw)) return DEFAULT_WORKING_DAYS;
  const days = raw
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  // An empty week would make every "add N working days" loop forever, so an
  // unset or nonsense value falls back to the default six-day week.
  return days.length > 0 ? Array.from(new Set(days)) : DEFAULT_WORKING_DAYS;
}

function parseHolidays(value: unknown): readonly string[] {
  const raw = typeof value === "string" ? safeParse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => (typeof d === "string" ? d.slice(0, 10) : ""))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Normalises the two json columns (or their already-parsed form) into a calendar. */
export function toCalendar(workingDays: unknown, holidays: unknown): WorkingCalendar {
  return { workingDays: parseDays(workingDays), holidays: parseHolidays(holidays) };
}

/** The `yyyy-mm-dd` part of an instant, in UTC. */
export function isoDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function isWorkingDay(value: Date | string, calendar: WorkingCalendar = DEFAULT_CALENDAR): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (!calendar.workingDays.includes(date.getUTCDay())) return false;
  return !calendar.holidays.includes(isoDate(date));
}

/**
 * Working days in `[from, to]`, both ends inclusive — Mon–Fri on a five-day
 * week is 5, not 4. Returns 0 when `to` falls before `from`.
 */
export function countWorkingDays(
  from: Date | string,
  to: Date | string,
  calendar: WorkingCalendar = DEFAULT_CALENDAR,
): number {
  const start = Date.parse(`${isoDate(from)}T00:00:00.000Z`);
  const end = Date.parse(`${isoDate(to)}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  let count = 0;
  for (let ms = start; ms <= end; ms += DAY_MS) {
    if (isWorkingDay(new Date(ms), calendar)) count += 1;
  }
  return count;
}

/**
 * Moves an instant by `days` working days, keeping its time of day. A positive
 * count walks forward over working days only; a negative count walks back. Zero
 * returns the instant untouched (it never "snaps" onto a working day, so a
 * no-op cascade leaves the programme byte-identical).
 */
export function addWorkingDays(
  value: Date | string,
  days: number,
  calendar: WorkingCalendar = DEFAULT_CALENDAR,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(value).toISOString();
  const whole = Math.trunc(days);
  if (whole === 0) return date.toISOString();
  const step = whole > 0 ? DAY_MS : -DAY_MS;
  let ms = date.getTime();
  let remaining = Math.abs(whole);
  while (remaining > 0) {
    ms += step;
    if (isWorkingDay(new Date(ms), calendar)) remaining -= 1;
  }
  return new Date(ms).toISOString();
}

/** Every working date in `[from, to]` as `yyyy-mm-dd`, both ends inclusive. */
export function workingDatesBetween(
  from: Date | string,
  to: Date | string,
  calendar: WorkingCalendar = DEFAULT_CALENDAR,
): string[] {
  const start = Date.parse(`${isoDate(from)}T00:00:00.000Z`);
  const end = Date.parse(`${isoDate(to)}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const dates: string[] = [];
  for (let ms = start; ms <= end; ms += DAY_MS) {
    const date = new Date(ms);
    if (isWorkingDay(date, calendar)) dates.push(isoDate(date));
  }
  return dates;
}

/** Calendar days added to a date, keeping the time of day (EOT awards are calendar days). */
export function addCalendarDays(value: Date | string, days: number): string {
  const date = new Date(value);
  return new Date(date.getTime() + Math.trunc(days) * DAY_MS).toISOString();
}
