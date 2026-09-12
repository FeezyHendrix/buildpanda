import { type ReactNode } from "react";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "danger";

interface KpiCardProps {
  /** Small muted caption above the value. */
  label: string;
  /** The headline figure. Ignored when `progress` is set (the percentage becomes the value). */
  value?: ReactNode;
  /** One short line beside the value ("of $1.5M"). */
  helper?: ReactNode;
  /** Accepted for compatibility and ignored: a KPI card is a label and a figure, nothing else. */
  icon?: ReactNode;
  /** 0–100. Renders the percentage as the value with a progress bar under it. */
  progress?: number;
  tone?: KpiTone;
  className?: string;
}

const VALUE_TONE: Record<KpiTone, string> = {
  default: "text-ink",
  danger: "text-negative-500",
};

/**
 * The one KPI card (Ernest's card tile): muted 14px title, 26px medium figure
 * with the helper set beside it. Strips are `grid gap-4` with equal cards.
 */
function KpiCard({ label, value, helper, progress, tone = "default", className }: KpiCardProps) {
  const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
  const headline = pct === undefined ? value : `${pct}%`;

  return (
    <Card padding="md" className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p
          className={cn(
            "min-w-0 text-3xl font-medium tabular-nums [overflow-wrap:anywhere]",
            VALUE_TONE[tone],
          )}
        >
          {headline}
        </p>
        {helper ? <p className="text-base font-medium text-ink-muted">{helper}</p> : null}
      </div>
      {pct !== undefined ? <ProgressBar tone="success" value={pct} size="md" className="mt-2" /> : null}
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps, type KpiTone };
