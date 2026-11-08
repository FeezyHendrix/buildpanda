import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ScheduleReport } from "./schedule-utils";

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

function StatCard({ label, value, note, indicator }: { label: string; value: string; note: string; indicator?: ReactNode }) {
  return (
    <article className="flex h-[152px] flex-col border border-[#EEEEEE] bg-white">
      <h3 className="h-[35px] shrink-0 border-b border-[#EEEEEE] px-[11px] text-[14px] font-medium leading-[34px] text-[#1E1E1E]">
        {label}
      </h3>
      <div className="px-[11px] pt-[16px]">
        <p className="text-[24px] font-semibold leading-[32px] text-[#1E1E1E]">{value}</p>
        <p className="mt-[5px] text-[14px] leading-[20px] text-[#737373]">{note}</p>
        {indicator ? <div className="mt-[3px] text-[12px] font-medium leading-[16px]">{indicator}</div> : null}
      </div>
    </article>
  );
}

/**
 * The chart's four figures. The completion position is a fact about the project,
 * not something the chart may work out for itself: the timeline shift and the
 * projected end come from the same reporting snapshot the overview reads, so the
 * two pages can never give a PM two answers to the same question.
 */
export function ScheduleReportPanel({
  report,
  loggedToday,
  timelineShiftDays,
  projectedEndDate,
  workItems,
  timelineShiftStatus,
}: {
  report: ScheduleReport;
  /** Daily logs dated today. */
  loggedToday: number;
  /** Signed working-day shift off the baseline programme; null until loaded. */
  timelineShiftDays: number | null;
  projectedEndDate: string | null;
  workItems?: { total: number; completed: number; remaining: number };
  timelineShiftStatus?: "on_schedule" | "behind" | "ahead";
}) {
  // The server's figures when the snapshot has them; the chart's own count until it loads.
  const total = workItems?.total ?? report.activityCount;
  const completed = workItems?.completed ?? report.completedActivities;
  const remaining = workItems?.remaining ?? Math.max(0, total - completed);
  const shift = timelineShiftDays ?? 0;
  const behind = (timelineShiftStatus ?? (shift > 0 ? "behind" : shift < 0 ? "ahead" : "on_schedule")) === "behind";
  const end = projectedEndDate ? new Date(projectedEndDate) : null;
  const endValid = end !== null && !Number.isNaN(end.getTime());

  return (
    <section aria-label="Schedule report" className="grid gap-[20px] sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Work Items"
        value={`${completed}/${total}`}
        note="completed"
        indicator={
          remaining > 0 ? (
            <span className="text-[#E7000B]">↓ {remaining} remaining</span>
          ) : (
            <span className="text-[#00A63E]">✓ All complete</span>
          )
        }
      />
      <StatCard label="Daily Logs" value={String(loggedToday)} note="logged today" />
      <StatCard
        label="Timeline Shift"
        value={timelineShiftDays === null ? "—" : `${shift}d`}
        note={shift === 0 ? "no net change" : behind ? "behind the baseline" : "ahead of the baseline"}
        indicator={
          timelineShiftDays === null ? null : (
            <span className={cn(behind ? "text-[#E7000B]" : "text-[#00A63E]")}>
              {behind ? "↓ Behind Schedule" : "↑ On Schedule"}
            </span>
          )
        }
      />
      <StatCard
        label="Projected End"
        value={endValid ? end.toLocaleDateString("en-US", MONTH_DAY) : "—"}
        note={endValid ? String(end.getFullYear()) : "after approved extensions of time"}
      />
    </section>
  );
}

ScheduleReportPanel.displayName = "ScheduleReportPanel";
