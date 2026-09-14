const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The web pins this locale too, so a date reads the same on both clients. */
const DATE_LOCALE = "en-GB";

/** One separator for every date range in the app. */
export const RANGE_SEPARATOR = " – ";

type DateInput = string | number | null | undefined;

/** True for a calendar date in the `YYYY-MM-DD` form every API date field takes. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * A bare calendar date is read as local midnight so it never slips a day
 * across the UTC line; anything else (ISO timestamp, epoch ms) is taken as is.
 */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "string" && ISO_DATE.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(DATE_LOCALE, options) : "";
}

/** `11 Sept 2026` — the default for any date shown on its own. Empty when unparseable. */
export function formatDate(value: DateInput): string {
  return format(value, { day: "numeric", month: "short", year: "numeric" });
}

/** `11 Sept, 14:05` — for a timestamp on a comment or a decision. */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date
    ? date.toLocaleString(DATE_LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
}

/** `11 Sept` — inside a row or a range, where the year is clutter. */
export function formatShortDate(value: DateInput): string {
  return format(value, { day: "numeric", month: "short" });
}

/** `Fri 11 Sept` — a day the crew thinks of by weekday (daily log). */
export function formatDayLabel(value: DateInput): string {
  return format(value, { weekday: "short", day: "numeric", month: "short" });
}

/** `Friday 11 September` — a page description for one day. */
export function formatLongDayLabel(value: DateInput): string {
  return format(value, { weekday: "long", day: "numeric", month: "long" });
}

/** `11 Sept – 24 Sept`; an end missing on either side becomes a dash so the row keeps its shape. */
export function formatDateRange(start: DateInput, end: DateInput): string {
  return `${formatShortDate(start) || "—"}${RANGE_SEPARATOR}${formatShortDate(end) || "—"}`;
}
