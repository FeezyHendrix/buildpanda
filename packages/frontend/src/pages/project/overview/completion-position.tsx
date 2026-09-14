import { Badge } from "@/components/atoms/badge";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import type { ProjectReportingSnapshot } from "@/hooks/use-reporting-snapshot";

interface CompletionPositionProps {
  schedule: ProjectReportingSnapshot["schedule"] | undefined;
  currency: string;
}

function daysLabel(days: number): string {
  return `${days} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

/**
 * The completion date, the EOT position and the liquidated-damages exposure —
 * the three numbers a road PM is actually managing, and the ones the Overview
 * never stated (findings F55, #48). Each line renders only once the programme
 * snapshot carries the figure, so the card is honest before the fields land.
 */
function CompletionPosition({ schedule, currency }: CompletionPositionProps) {
  if (!schedule) return null;

  const completion = schedule.completionDate ?? null;
  const revised = schedule.revisedCompletionDate ?? null;
  const eotApproved = schedule.eotDaysApproved ?? null;
  const eotPending = schedule.eotDaysPending ?? null;
  const ldExposure = schedule.ldExposure ?? null;
  const shift = schedule.timelineShiftDays ?? null;
  const delayed = schedule.delayedActivities ?? null;

  const hasAnything =
    completion ||
    revised ||
    (eotApproved ?? 0) > 0 ||
    (eotPending ?? 0) > 0 ||
    ldExposure !== null ||
    (shift !== null && shift !== 0) ||
    (delayed !== null && delayed.count > 0);
  if (!hasAnything) return null;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-line-hair p-3">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black-300">
        Completion position
      </p>

      {completion ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Contract completion</span>
          <span className="font-medium text-black-500">{formatShortDate(completion)}</span>
        </div>
      ) : null}

      {revised && revised !== completion ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Revised completion</span>
          <span className="font-medium text-black-500">{formatShortDate(revised)}</span>
        </div>
      ) : null}

      {/* The server sends 0 rather than null for these, so an empty EOT
          position would otherwise add a permanent "None" line to the card. */}
      {(eotApproved ?? 0) > 0 || (eotPending ?? 0) > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Extension of time</span>
          <span className="flex items-center gap-1.5">
            {eotApproved ? (
              <Badge tone="success" size="sm">✓ {daysLabel(eotApproved)} awarded</Badge>
            ) : null}
            {eotPending ? (
              <Badge tone="warning" size="sm">◷ {daysLabel(eotPending)} claimed</Badge>
            ) : null}
          </span>
        </div>
      ) : null}

      {ldExposure !== null ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Liquidated damages exposure</span>
          <span className="font-medium tabular-nums text-black-500">
            {ldExposure > 0 ? (
              <Badge tone="danger" size="sm">⚠ {formatWholeCurrency(ldExposure, currency)}</Badge>
            ) : (
              formatWholeCurrency(0, currency)
            )}
          </span>
        </div>
      ) : null}

      {shift !== null && shift !== 0 ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Timeline shift</span>
          <span className="font-medium tabular-nums text-black-500">
            {shift > 0 ? `+${daysLabel(shift)}` : daysLabel(shift)}
          </span>
        </div>
      ) : null}

      {delayed && delayed.count > 0 ? (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-black-300">Delayed activities</span>
          <span className="font-medium tabular-nums text-black-500">
            {delayed.count} · {daysLabel(delayed.daysLost)} lost
          </span>
        </div>
      ) : null}
    </section>
  );
}

CompletionPosition.displayName = "CompletionPosition";

export { CompletionPosition, type CompletionPositionProps };
