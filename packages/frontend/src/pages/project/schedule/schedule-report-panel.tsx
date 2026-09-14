import { KpiCard } from "@/components/molecules/kpi-card";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { ScheduleReport } from "./schedule-utils";

/**
 * The chart's own KPI strip.
 *
 * The completion position is a fact about the project, not something the chart
 * may work out for itself: the timeline shift and the revised completion date
 * come from the same reporting snapshot the overview reads, so the two pages
 * can never give a PM two answers to the same question.
 */
export function ScheduleReportPanel({
  report,
  currency,
  timelineShiftDays,
  revisedCompletionDate,
}: {
  report: ScheduleReport;
  currency: string;
  /** Signed working-day shift off the baseline programme; null until loaded. */
  timelineShiftDays: number | null;
  revisedCompletionDate: string | null;
}) {
  const shift = timelineShiftDays ?? 0;
  const shiftLabel =
    timelineShiftDays === null ? "—" : `${shift > 0 ? "+" : ""}${shift} d`;

  return (
    <section
      aria-label="Schedule report"
      // Same reason as the overview strip: six across on a laptop leaves each
      // card narrower than the figures and dates it holds.
      className="grid shrink-0 gap-4 border-b border-line-hair p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
    >
      <KpiCard label="Milestone cost" value={formatCurrency(report.milestoneCost, currency, { compact: true })} />
      <KpiCard label="Work items" value={`${report.completedActivities}/${report.activityCount}`} helper="completed" />
      <KpiCard label="Daily logs" value={String(report.dailyLogCount)} />
      <KpiCard
        label="Delay cost"
        value={formatCurrency(report.delayCost, currency, { compact: true })}
        tone={report.delayCost > 0 ? "danger" : undefined}
      />
      <KpiCard
        label="Timeline shift"
        value={shiftLabel}
        helper="against the baseline programme"
        tone={shift > 0 ? "danger" : undefined}
      />
      <KpiCard
        label="Revised completion"
        value={revisedCompletionDate ? formatShortDate(revisedCompletionDate) : "—"}
        helper="after approved extensions of time"
      />
    </section>
  );
}

ScheduleReportPanel.displayName = "ScheduleReportPanel";
