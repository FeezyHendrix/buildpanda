import type { BadgeTone } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { isSettled, percentPaid } from "../settlement-statement";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * How the contract is doing, at a glance: the share of the adjusted contract
 * already received as a gauge, and one status word. The status is derived only
 * from figures the summary already reports; nothing here is a new record.
 */

interface HealthStatus {
  tone: BadgeTone;
  label: string;
}

export function contractHealth(summary: FinanceSummary): HealthStatus {
  if (isSettled(summary)) return { tone: "success", label: "Settled" };
  if (summary.ldExposure && summary.ldExposure.amount > 0) {
    const days = summary.ldExposure.daysLate;
    return { tone: "danger", label: `${days} ${days === 1 ? "day" : "days"} late` };
  }
  if (summary.unpaidCertified > 0) return { tone: "warning", label: "Unpaid certified" };
  if (summary.adjustedContract <= 0) return { tone: "neutral", label: "No contract sum" };
  return { tone: "success", label: "On track" };
}

const PILL_CLASS: Record<BadgeTone, string> = {
  success: "bg-[#F0FDF4] text-[#00A63E]",
  warning: "bg-[#FFF8E6] text-[#E17100]",
  danger: "bg-[#FEF2F2] text-[#E7000B]",
  neutral: "bg-[#F5F5F5] text-[#737373]",
  info: "bg-[#E6EDFD] text-[#004DE7]",
  accent: "bg-[#F6EEFD] text-[#5D5FEF]",
};

/** A half-ring meter: the track is the light step of the same hue so state reads across the whole arc. */
function Gauge({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg
      viewBox="0 0 120 68"
      className="w-full max-w-[190px]"
      role="img"
      aria-label={`${clamped}% of the adjusted contract received`}
    >
      <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" strokeWidth={12} strokeLinecap="round" className="stroke-[#E5E5E5]" />
      <path
        d="M 10 60 A 50 50 0 0 1 110 60"
        fill="none"
        strokeWidth={12}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${clamped} 100`}
        className="stroke-[#004DE7] transition-[stroke-dasharray] duration-500"
      />
      <text x="60" y="58" textAnchor="middle" className="fill-[#1E1E1E] text-[22px] font-bold">
        {clamped}%
      </text>
    </svg>
  );
}

Gauge.displayName = "Gauge";

export function ContractHealthCard({ summary }: { summary: FinanceSummary }) {
  const status = contractHealth(summary);
  const percent = percentPaid(summary);
  const money = (value: number) => formatCurrency(value, summary.currency);

  return (
    <OverviewCard
      title="Contract health"
      bodyClassName="pt-[24px]"
      actions={
        <span className={cn("inline-flex h-[22px] items-center rounded-full px-[10px] text-caption-m font-medium", PILL_CLASS[status.tone])}>
          {status.label}
        </span>
      }
    >
      <div className="flex flex-col items-center pb-[12px]">
        <Gauge percent={percent} />
        <p className="mt-[4px] text-caption-m text-[#737373]">received of {money(summary.adjustedContract)}</p>
      </div>

      <OverviewList className="border-b border-[#EEEEEE]">
        <OverviewRow label="Retention held" value={money(summary.retentionHeld)} />
        <OverviewRow label="Variations" value={formatCurrency(summary.variationsTotal, summary.currency, { signed: true })} />
      </OverviewList>
    </OverviewCard>
  );
}

ContractHealthCard.displayName = "ContractHealthCard";
