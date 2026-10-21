import { config } from "../config/index.ts";

/**
 * A clock time a person reads in a report, in the site's timezone. Reports are
 * rendered on a UTC server, so leaving the zone off (or pinning UTC, as the
 * sibling calendar-date helpers correctly do for `T00:00:00Z` dates) printed
 * every timestamp an hour early for a Lagos site. This helper is the one home
 * for that rule — the bug recurred precisely because each new report copied a
 * private formatter.
 */
export function formatReportTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  } as const;
  try {
    return parsed.toLocaleString("en-GB", { ...options, timeZone: config.timezone });
  } catch {
    // An invalid PROJECT_TIMEZONE must not take report generation down.
    return parsed.toLocaleString("en-GB", { ...options, timeZone: "UTC" });
  }
}
