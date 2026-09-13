/**
 * The project's working week, said in words.
 *
 * A missed-day figure is meaningless until the reader knows which days could
 * have been missed, so every surface that shows one names the calendar it was
 * counted on rather than leaving the PM to assume Mon–Fri.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Mon–Sat", "Mon–Fri", "Mon, Wed, Fri" — or null when nothing is configured. */
export function describeWorkingWeek(workingDays: readonly number[] | undefined): string | null {
  if (!workingDays || workingDays.length === 0) return null;

  const days = [...new Set(workingDays)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  if (days.length === 7) return "every day";

  // A single unbroken run reads as a range; anything else is listed out.
  const isRun = days.every((day, i) => i === 0 || day === days[i - 1]! + 1);
  if (isRun && days.length > 2) return `${DAY_NAMES[days[0]!]}–${DAY_NAMES[days[days.length - 1]!]}`;
  return days.map((d) => DAY_NAMES[d]!).join(", ");
}

/** The helper line under a missed-days figure: what was counted, on which calendar. */
export function describeCoverageBasis(
  workingDays: readonly number[] | undefined,
  holidays: readonly string[] | undefined,
): string {
  const week = describeWorkingWeek(workingDays);
  const base = week
    ? `working days (${week}) since work started, with no live log`
    : "days since work started with no live log";
  const holidayCount = holidays?.length ?? 0;
  if (holidayCount === 0) return `${base}. Today is not counted until it is over.`;
  return `${base}. ${holidayCount} project holiday${holidayCount === 1 ? "" : "s"} and today are excluded.`;
}
