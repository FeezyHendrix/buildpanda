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
  /** One short line under the value. */
  helper?: ReactNode;
  /** Accepted for compatibility and ignored: a KPI card is a label and a figure, nothing else. */
  icon?: ReactNode;
  /** 0–100. Renders the percentage as the value with a progress bar under it. */
  progress?: number;
  tone?: KpiTone;
  className?: string;
}

const VALUE_TONE: Record<KpiTone, string> = {
  default: "text-black-500",
  danger: "text-error-600",
};

/**
 * The one KPI card. Every summary strip on the app (stages, key dates, finances,
 * materials, invoices, the chart report) renders through this molecule so the
 * cards read as one product: white card, muted label, big tabular figure.
 * Strips are `grid gap-4` with equal cards — never corner-joined.
 */
function KpiCard({ label, value, helper, progress, tone = "default", className }: KpiCardProps) {
  const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
  const headline = pct === undefined ? value : `${pct}%`;

  return (
    <Card padding="md" className={cn("flex min-w-0 flex-col gap-3 p-5", className)}>
      <p className="text-[13px] font-medium text-black-300">{label}</p>

      <div className="flex flex-col gap-2">
        <p
          className={cn(
            "text-[25px] font-bold leading-tight tabular-nums [overflow-wrap:anywhere]",
            VALUE_TONE[tone],
          )}
        >
          {headline}
        </p>
        {pct !== undefined ? <ProgressBar tone="success" value={pct} size="md" /> : null}
        {helper ? <p className="text-[13px] text-black-300">{helper}</p> : null}
      </div>
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps, type KpiTone };
