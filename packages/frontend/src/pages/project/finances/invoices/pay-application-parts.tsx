import { Button } from "@/components/atoms/button";
import { Money } from "@/lib/money";
import type { Stage } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * Shared read-outs for the pay application: the stacked "completion tape", the
 * G702 summary figures, and the picker that puts another build stage on the
 * application. Kept beside the row so the drawer stays a thin composition root.
 */

/** Share of the contract sum as a 0–100 number. Bar widths only, not money. */
export function sharePercent(part: Money, contractSum: number): number {
  if (contractSum <= 0) return 0;
  const share = part.div(contractSum).mul(100).toNumber();
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

interface CompletionBarProps {
  /** Share of the contract sum billed in previous applications, 0–100. */
  priorShare: number;
  /** Share completed and stored to date (prior included), 0–100. */
  completedShare: number;
  overBilled: boolean;
  className?: string;
}

/**
 * Three positions in one glyph: billed in previous applications, added by this
 * application, and the balance to finish. Every segment is also named in the
 * legend and quoted as a number nearby, so nothing depends on colour alone.
 */
export function CompletionBar({
  priorShare,
  completedShare,
  overBilled,
  className,
}: CompletionBarProps) {
  const thisApplicationShare = Math.max(0, completedShare - priorShare);
  const currentClass = overBilled ? "bg-error-500" : "bg-primary-200";

  return (
    <div className={className}>
      <div
        aria-hidden="true"
        className="flex h-2 w-full overflow-hidden rounded-full bg-grey-50"
      >
        <div
          className="bg-primary-500 transition-[width] duration-300"
          style={{ width: `${priorShare}%` }}
        />
        <div
          className={cn("transition-[width] duration-300", currentClass)}
          style={{ width: `${thisApplicationShare}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-black-300">
        <LegendKey swatchClassName="bg-primary-500" label="Previous applications" />
        <LegendKey
          swatchClassName={currentClass}
          label={overBilled ? "Over the contract sum" : "This application"}
        />
        <LegendKey swatchClassName="bg-grey-50" label="Balance to finish" />
      </div>
    </div>
  );
}

CompletionBar.displayName = "CompletionBar";

interface SummaryFigureProps {
  label: string;
  value: string;
  caption?: string;
  emphasis?: boolean;
  align?: "left" | "right";
}

/** One G702 line: a small caps label over a tabular figure. */
export function SummaryFigure({
  label,
  value,
  caption,
  emphasis = false,
  align = "left",
}: SummaryFigureProps) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-black-200">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-bold tabular-nums",
          emphasis ? "text-2xl text-primary-500" : "text-lg text-black-500",
        )}
      >
        {value}
      </p>
      {caption ? (
        <p className="mt-0.5 text-xs tabular-nums text-black-300">{caption}</p>
      ) : null}
    </div>
  );
}

SummaryFigure.displayName = "SummaryFigure";

interface StagePickerProps {
  /** Stages that are not already on the application. */
  options: Stage[];
  value: string;
  onChange: (stageId: string) => void;
  onAdd: () => void;
}

/**
 * Puts another build stage on the application. Only stages that are not
 * already billed here are offered, so a stage can never appear twice and
 * silently double-bill itself.
 */
export function StagePicker({
  options,
  value,
  onChange,
  onAdd,
}: StagePickerProps) {
  const exhausted = options.length === 0;

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={exhausted}
        aria-label="Build stage to add to this application"
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg bg-[#F6F6F6] px-3 text-sm text-black-500 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {exhausted ? "Every stage is on this application" : "Add a stage…"}
        </option>
        {options.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={exhausted || value === ""}
        onClick={onAdd}
      >
        Add stage
      </Button>
    </div>
  );
}

StagePicker.displayName = "StagePicker";
