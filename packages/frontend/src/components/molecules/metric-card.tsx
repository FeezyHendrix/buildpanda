import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface MetricCardTrend {
  /** e.g. "10% vs Last month" */
  label: string;
  direction?: "up" | "down";
  /** Color of the arrow + label. Defaults to "positive" (green). */
  tone?: "positive" | "negative";
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Plain gray subtitle, e.g. "Across all phases". Ignored if `trend` is set. */
  helperText?: string;
  /** Colored trend line with an arrow, e.g. "↑ 10% vs Last month". Takes priority over `helperText`. */
  trend?: MetricCardTrend;
  className?: string;
}

const TREND_TONE: Record<NonNullable<MetricCardTrend["tone"]>, string> = {
  positive: "text-[#00A63E]",
  negative: "text-error-400",
};

function MetricCard({ label, value, helperText, trend, className }: MetricCardProps) {
  return (
    <div className={cn("border-[0.5px] border-[#EBEBEB] bg-white", className)}>
      <div className="border-b border-[#EBEBEB] px-4 py-2.5">
        <p className="text-caption-l font-semibold text-black-500">{label}</p>
      </div>
      <div className="px-4 py-3">
        <p className="text-h6 font-bold text-black-500">{value}</p>
        {trend ? (
          <p className={cn("mt-1 flex items-center gap-1 text-caption-l font-semibold", TREND_TONE[trend.tone ?? "positive"])}>
            <span>{trend.direction === "down" ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}</span>
            {trend.label}
          </p>
        ) : (
          helperText && <p className="mt-1 text-caption-l font-medium text-grey-450">{helperText}</p>
        )}
      </div>
    </div>
  );
}

MetricCard.displayName = "MetricCard";

export { MetricCard, type MetricCardProps, type MetricCardTrend };
