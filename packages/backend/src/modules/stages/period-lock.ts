import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import type { StageScheduleOfValue } from "./types.ts";

/**
 * What a billing month may still be changed to, once it has been valued.
 *
 * A valuation is a measurement of work done TO A DATE, and a certificate is the
 * formal record of that measurement. Two rules follow, and neither is cosmetic:
 *
 *  • Once a month is certified its cells are closed. Re-typing 40% as 50% after
 *    IPC-001 went out leaves the sheet and the certificate saying different
 *    things about the same month; the correction belongs on the NEXT
 *    certificate, which is how a re-measurement is agreed on a real job.
 *  • A month that has not happened yet cannot be claimed. It may be entered as
 *    a FORECAST — a QS genuinely does project next month's valuation — but it
 *    is marked as one and never reads as claimable.
 *
 * Lives beside `period-billing.ts` rather than in the stages service so the
 * lock is one small, testable concern of its own.
 */

/** The certificate a month was billed on, when there is one. */
export interface PeriodCertificate {
  id: string;
  number: string | null;
}

export interface PeriodLockDeps {
  /** The live certificate raised for a billing month, from the invoices module. */
  certificateForPeriod: (projectId: string, period: string) => Promise<PeriodCertificate | undefined>;
}

/** YYYY-MM of the month a date falls in. */
export function periodOf(date: string): string {
  return date.slice(0, 7);
}

/** A month later than the current one has not been worked yet. */
export function isForecastPeriod(period: string, today = new Date().toISOString().slice(0, 10)): boolean {
  return period > periodOf(today);
}

/**
 * Marks the lines that sit in the future. A forecast line carries real figures
 * — it is the QS's projection — but `claimable: false` says it is not work
 * anyone may certify yet.
 */
export function withForecastFlags(
  lines: StageScheduleOfValue[],
  billedPeriods: ReadonlySet<string> = new Set(),
  today = new Date().toISOString().slice(0, 10),
): StageScheduleOfValue[] {
  return lines.map((line) => {
    const forecast = isForecastPeriod(line.period, today);
    return {
      ...line,
      forecast,
      claimable: !forecast && !billedPeriods.has(line.period),
    };
  });
}

export function periodLock(deps: PeriodLockDeps) {
  return {
    /**
     * Refuses an edit to a month that has already been certified, naming the
     * certificate so the user knows where the figure now lives.
     */
    async assertEditable(projectId: string, period: string): Promise<void> {
      const certificate = await deps.certificateForPeriod(projectId, period);
      if (certificate) {
        throw new ConflictError(
          `Period ${period} is certified on ${certificate.number ?? "an issued certificate"}; raise a correction on the next certificate`,
        );
      }
    },

    /**
     * A future month is accepted only when the caller says it is a forecast, so
     * nobody claims work that has not happened by accident.
     */
    assertClaimable(period: string, forecast: boolean, today = new Date().toISOString().slice(0, 10)): void {
      if (isForecastPeriod(period, today) && !forecast) {
        throw new BadRequestError(
          `${period} has not been worked yet — record it as a forecast, or value a month up to ${periodOf(today)}`,
        );
      }
    },

    /** An unbilled month can be dropped from the sheet; a certified one cannot. */
    async assertRemovable(projectId: string, period: string): Promise<void> {
      await this.assertEditable(projectId, period);
    },
  };
}

export type PeriodLock = ReturnType<typeof periodLock>;
