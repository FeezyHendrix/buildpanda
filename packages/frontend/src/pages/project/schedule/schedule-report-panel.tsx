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
    <section className="grid shrink-0 grid-cols-2 gap-3 border-b border-[#EDEDED] bg-[#FAFAFA] p-4 lg:grid-cols-6">
      <ReportMetric label="Milestone cost" value={formatCurrency(report.milestoneCost, currency, { compact: true })} />
      <ReportMetric label="Work items" value={`${report.completedActivities}/${report.activityCount}`} helper="completed" />
      <ReportMetric label="Daily logs" value={String(report.dailyLogCount)} />
      <ReportMetric label="Delay cost" value={formatCurrency(report.delayCost, currency, { compact: true })} tone={report.delayCost > 0 ? "danger" : undefined} />
      <ReportMetric label="Timeline shift" value={`${movedDays} d`} tone={movedDays > 0 ? "danger" : undefined} />
      <ReportMetric label="Projected end" value={formatDate(report.projectedEnd)} />
    </section>
  );
}

function ReportMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-lg font-semibold tabular-nums text-[#C72525]" : "mt-1 text-lg font-semibold tabular-nums text-gray-900"}>
        {value}
      </p>
      {helper && <p className="mt-0.5 text-[11px] text-gray-400">{helper}</p>}
    </div>
  );
}
