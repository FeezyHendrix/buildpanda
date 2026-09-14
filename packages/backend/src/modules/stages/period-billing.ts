import { Money } from "../../lib/money.ts";
import type { PeriodBillingLine, ProgressLineInput } from "./types.ts";

/**
 * Turns a stage's cumulative percent-complete lines into what each month bills.
 *
 * Cumulative is the figure a QS records (AIA G703 column G): the share of the
 * stage finished by the end of the month. What the month INVOICES is the
 * movement since the last recorded month, so the period amount is the
 * difference between this month's to-date amount and the previous one — never
 * `periodPct × value` rounded separately, which would let the months drift
 * from the to-date figure by a cent.
 *
 * Months with no recorded figure bill nothing and carry the previous to-date
 * amount forward. Lines are ordered by period, whatever order they arrive in.
 */
export function periodBilling(
  lines: ProgressLineInput[],
  scheduledValue: number,
): PeriodBillingLine[] {
  const value = Money.of(Number.isFinite(scheduledValue) ? scheduledValue : 0);
  const ordered = [...lines].sort((a, b) => a.period.localeCompare(b.period));

  let previousPct = Money.zero();
  let previousToDate = Money.zero();
  return ordered.map((line) => {
    if (line.percentComplete === null) {
      return {
        period: line.period,
        cumulativePct: null,
        periodPct: 0,
        periodAmount: 0,
        toDateAmount: previousToDate.toNumber(),
      };
    }
    const cumulative = Money.of(line.percentComplete);
    const toDate = value.percent(cumulative).round(2);
    const periodAmount = toDate.sub(previousToDate).round(2);
    const periodPct = cumulative.sub(previousPct).round(4);
    previousPct = cumulative;
    previousToDate = toDate;
    return {
      period: line.period,
      cumulativePct: cumulative.toNumber(),
      periodPct: periodPct.toNumber(),
      periodAmount: periodAmount.toNumber(),
      toDateAmount: toDate.toNumber(),
    };
  });
}
