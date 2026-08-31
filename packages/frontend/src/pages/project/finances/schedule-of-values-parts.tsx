import { Money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Shared read-outs for the Schedule of Values: the stacked "scheduling tape"
 * and the two number formatters the stage list and the editor both use, so a
 * stage reads identically on the page and inside the drawer.
 */

/** A percentage as a lean string: 72, 72.5 — never 72.00. */
export function formatPercent(value: Money): string {
  return value.round(2).toString();
}

/** Share of the stage value as a 0–100 number. Bar widths only, not money. */
export function sharePercent(part: Money, stageValue: number): number {
  if (stageValue <= 0) return 0;
  const share = part.div(stageValue).mul(100).toNumber();
  return Math.max(0, Math.min(100, share));
}

interface LegendKeyProps {
  swatchClassName: string;
  label: string;
}

function LegendKey({ swatchClassName, label }: LegendKeyProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-[3px]", swatchClassName)}
      />
      {label}
    </span>
  );
}

LegendKey.displayName = "LegendKey";

interface ScheduleBarProps {
  /** Share of the stage value already billed, 0–100. */
  billedShare: number;
  /** Share of the stage value carried on the schedule, 0–100. */
  scheduledShare: number;
  overBooked: boolean;
  /** Legend costs vertical space; drop it in tight rows. */
  showLegend?: boolean;
  className?: string;
}

/**
 * Three money states in one glyph: billed, scheduled-but-not-billed, and the
 * unscheduled remainder of the stage. Every segment is also named in the legend
 * and quoted as a number nearby, so nothing here depends on colour alone.
 */
export function ScheduleBar({
  billedShare,
  scheduledShare,
  overBooked,
  showLegend = true,
  className,
}: ScheduleBarProps) {
  const pendingShare = Math.max(0, scheduledShare - billedShare);
  const pendingClass = overBooked ? "bg-error-500" : "bg-primary-200";

  return (
    <div className={className}>
      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-full bg-grey-50"
      >
        <div
          className="bg-primary-500 transition-[width] duration-300"
          style={{ width: `${billedShare}%` }}
        />
        <div
          className={cn("transition-[width] duration-300", pendingClass)}
          style={{ width: `${pendingShare}%` }}
        />
      </div>

      {showLegend ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black-300">
          <LegendKey swatchClassName="bg-primary-500" label="Billed" />
          <LegendKey
            swatchClassName={pendingClass}
            label={overBooked ? "Over 100%" : "Scheduled, not billed"}
          />
          <LegendKey swatchClassName="bg-grey-50" label="Unscheduled" />
        </div>
      ) : null}
    </div>
  );
}

ScheduleBar.displayName = "ScheduleBar";
