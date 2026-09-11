import { KpiCard } from "@/components/molecules/kpi-card";
import { formatCurrency } from "@/lib/formatters";
import type { ScheduleReport } from "./schedule-utils";
import { formatDate, DAY_MS } from "./schedule-utils";

export function ScheduleReportPanel({
  report,
  currency,
}: {
  report: ScheduleReport;
  currency: string;
}) {
  const movedDays =
    report.plannedEnd && report.projectedEnd
      ? Math.max(
          0,
          Math.ceil((report.projectedEnd.getTime() - report.plannedEnd.getTime()) / DAY_MS),
        )
      : 0;

  return (
    <section
      aria-label="Schedule report"
      className="grid shrink-0 gap-4 border-b border-[#EDEDED] p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <KpiCard label="Milestone cost" value={formatCurrency(report.milestoneCost, currency, { compact: true })} />
      <KpiCard label="Work items" value={`${report.completedActivities}/${report.activityCount}`} helper="completed" />
      <KpiCard label="Daily logs" value={String(report.dailyLogCount)} />
      <KpiCard
        label="Delay cost"
        value={formatCurrency(report.delayCost, currency, { compact: true })}
        tone={report.delayCost > 0 ? "danger" : undefined}
      />
      <KpiCard label="Timeline shift" value={`${movedDays} d`} tone={movedDays > 0 ? "danger" : undefined} />
      <KpiCard label="Projected end" value={formatDate(report.projectedEnd)} />
    </section>
  );
}
