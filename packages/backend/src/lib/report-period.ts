import { BadRequestError } from "./errors.ts";

export type ReportPeriod = "weekly" | "monthly" | "quarterly" | "semiAnnual" | "annual";

export const REPORT_PERIODS: readonly ReportPeriod[] = [
  "weekly",
  "monthly",
  "quarterly",
  "semiAnnual",
  "annual",
];

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiAnnual: "Semi-Annual",
  annual: "Annual",
};

export interface PeriodRange {
  from: string;
  to: string;
  rangeLabel: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDateUtc(value: string): Date {
  if (!DATE_RE.test(value)) throw new BadRequestError("date must be ISO date YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function shortLabelWithYear(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Calendar-aligned start/end (inclusive, ISO dates) for the period containing
 * `referenceDate`. Weeks are ISO (Monday–Sunday); semi-annual splits at H1
 * (Jan–Jun) / H2 (Jul–Dec).
 */
export function computePeriodRange(period: ReportPeriod, referenceDate: string): PeriodRange {
  const ref = parseIsoDateUtc(referenceDate);
  const year = ref.getUTCFullYear();
  let start: Date;
  let end: Date;
  let rangeLabel: string;

  if (period === "weekly") {
    const day = ref.getUTCDay();
    const isoDay = day === 0 ? 7 : day; // Monday=1 .. Sunday=7
    start = new Date(ref);
    start.setUTCDate(ref.getUTCDate() - (isoDay - 1));
    end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    rangeLabel = `${shortLabel(start)} – ${shortLabelWithYear(end)}`;
  } else if (period === "monthly") {
    start = new Date(Date.UTC(year, ref.getUTCMonth(), 1));
    end = new Date(Date.UTC(year, ref.getUTCMonth() + 1, 0));
    rangeLabel = start.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } else if (period === "quarterly") {
    const quarter = Math.floor(ref.getUTCMonth() / 3);
    start = new Date(Date.UTC(year, quarter * 3, 1));
    end = new Date(Date.UTC(year, quarter * 3 + 3, 0));
    rangeLabel = `Q${quarter + 1} ${year} (${shortLabel(start)} – ${shortLabelWithYear(end)})`;
  } else if (period === "semiAnnual") {
    const half = ref.getUTCMonth() < 6 ? 0 : 1;
    start = new Date(Date.UTC(year, half * 6, 1));
    end = new Date(Date.UTC(year, half * 6 + 6, 0));
    rangeLabel = `H${half + 1} ${year} (${shortLabel(start)} – ${shortLabelWithYear(end)})`;
  } else {
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Date.UTC(year, 11, 31));
    rangeLabel = String(year);
  }

  return { from: toIsoDate(start), to: toIsoDate(end), rangeLabel };
}
