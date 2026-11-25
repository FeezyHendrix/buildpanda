import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency } from "@/lib/project-types";
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
    <span className="inline-flex items-center gap-[8px]">
      <span aria-hidden="true" className={cn("size-[16px] shrink-0 rounded-full", swatchClassName)} />
      {label}
    </span>
  );
}

LegendKey.displayName = "LegendKey";

const BILLED_CLASS = "bg-[#004DE7]";
const UNSCHEDULED_CLASS = "bg-[#E5E5E5]";

interface ScheduleBarProps {
  /** Share of the stage value already billed, 0–100. */
  billedShare: number;
  /** Share of the stage value carried on the schedule, 0–100. */
  scheduledShare: number;
  overBooked: boolean;
  className?: string;
}

/**
 * Three money states in one glyph: billed, scheduled-but-not-billed, and the
 * unscheduled remainder of the stage. Every segment is also named in the legend
 * and quoted as a number nearby, so nothing here depends on colour alone.
 */
export function ScheduleBar({ billedShare, scheduledShare, overBooked, className }: ScheduleBarProps) {
  const pendingShare = Math.max(0, scheduledShare - billedShare);
  const pendingClass = overBooked ? "bg-[#E7000B]" : "bg-[#A9C4FA]";

  return (
    <div className={className}>
      <div aria-hidden="true" className={cn("flex h-[7px] w-full overflow-hidden", UNSCHEDULED_CLASS)}>
        <div className={cn("transition-[width] duration-300", BILLED_CLASS)} style={{ width: `${billedShare}%` }} />
        <div className={cn("transition-[width] duration-300", pendingClass)} style={{ width: `${pendingShare}%` }} />
      </div>

      <div className="mt-[17px] flex flex-wrap items-center gap-x-[32px] gap-y-1 text-caption-l text-[#1E1E1E]">
        <LegendKey swatchClassName={BILLED_CLASS} label="Billed" />
        <LegendKey swatchClassName={pendingClass} label={overBooked ? "Over 100%" : "Scheduled, not billed"} />
        <LegendKey swatchClassName={UNSCHEDULED_CLASS} label="Unscheduled" />
      </div>
    </div>
  );
}

ScheduleBar.displayName = "ScheduleBar";

interface ScheduleSummaryProps {
  currency: Currency;
  stageValue: number;
  totalPercent: Money;
  scheduledAmount: Money;
  billedAmount: Money;
  billedLines: number;
  lineCount: number;
  overBooked: boolean;
  remainingPercent: Money;
  unscheduled: Money;
}

/** How much of the stage is scheduled and how much of that is billed, with the one line saying what is left. */
export function ScheduleSummary({
  currency,
  stageValue,
  totalPercent,
  scheduledAmount,
  billedAmount,
  billedLines,
  lineCount,
  overBooked,
  remainingPercent,
  unscheduled,
}: ScheduleSummaryProps) {
  const message = overBooked
    ? `Over by ${formatPercent(remainingPercent.abs())}%. A stage cannot schedule more than 100% of its value — trim a line before saving.`
    : remainingPercent.isZero()
      ? "Fully scheduled. Every part of this stage's value sits on a billing month."
      : `${formatPercent(remainingPercent)}% (${formatCurrency(unscheduled.round().toNumber(), currency)}) is still unscheduled.`;

  return (
    <section aria-label="Schedule summary">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-caption-l text-[#737373]">Scheduled</p>
          <p className={cn("mt-[4px] text-[24px] font-medium leading-[32px] tabular-nums", overBooked ? "text-[#E7000B]" : "text-[#1E1E1E]")}>
            {formatPercent(totalPercent)}%
          </p>
          <p className="mt-[4px] text-caption-m tabular-nums text-[#737373]">
            {formatCurrency(scheduledAmount.round().toNumber(), currency)} of {formatCurrency(stageValue, currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-caption-l text-[#737373]">Billed to date</p>
          <p className="mt-[4px] text-[24px] font-medium leading-[32px] tabular-nums text-[#004DE7]">
            {formatCurrency(billedAmount.round().toNumber(), currency)}
          </p>
          <p className="mt-[4px] text-caption-m tabular-nums text-[#737373]">
            {billedLines} of {lineCount} {lineCount === 1 ? "line" : "lines"} billed
          </p>
        </div>
      </div>

      <ScheduleBar
        billedShare={sharePercent(billedAmount, stageValue)}
        scheduledShare={sharePercent(scheduledAmount, stageValue)}
        overBooked={overBooked}
        className="mt-[17px]"
      />

      <p
        className={cn(
          "mt-[23px] flex min-h-[36px] items-center justify-center px-[13px] py-[8px] text-center text-caption-m",
          overBooked ? "bg-[#FEF2F2] font-medium text-[#E7000B]" : "bg-[#F6F6F6] text-[#737373]",
        )}
      >
        {message}
      </p>
    </section>
  );
}

ScheduleSummary.displayName = "ScheduleSummary";
