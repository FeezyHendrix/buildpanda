import type { ReactNode } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { OverviewCard } from "./overview-card";

type StatTone = "default" | "danger";
type HelperTone = "muted" | "positive" | "negative";

interface OverviewStatCardProps {
  label: string;
  /** The headline figure. Ignored when `progress` is set. */
  value?: ReactNode;
  helper?: ReactNode;
  /** `positive`/`negative` colour the helper and lead it with a dot. */
  helperTone?: HelperTone;
  /** 0–100. Renders the percentage as the value with a bar under it. */
  progress?: number;
  tone?: StatTone;
  pending?: boolean;
  /** Anchor for the guided tour. */
  dataTour?: string;
}

const HELPER_TEXT: Record<HelperTone, string> = {
  muted: "text-[#737373]",
  positive: "text-[#00A63E]",
  negative: "text-[#E7000B]",
};

const HELPER_DOT: Record<Exclude<HelperTone, "muted">, string> = {
  positive: "bg-[#00A63E]",
  negative: "bg-[#E7000B]",
};

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-[#1E1E1E]",
  danger: "text-error-600",
};

function ProgressTrack({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-[4px] w-full bg-[#EEEEEE]"
    >
      <div className="h-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

/** One figure under a title bar: the overview's KPI tile. */
export function OverviewStatCard({
  label,
  value,
  helper,
  helperTone = "muted",
  progress,
  tone = "default",
  pending = false,
  dataTour,
}: OverviewStatCardProps) {
  const pct = progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
  const headline = pct === undefined ? value : `${pct}%`;

  return (
    <OverviewCard title={label} data-tour={dataTour}>
      {pending ? (
        <div className="flex h-[84px] items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="flex flex-col gap-[4px] px-[14px] pb-[20px] pt-[16px]">
          <p
            className={cn(
              "overflow-hidden text-ellipsis text-[22px] font-semibold leading-[28px] tabular-nums [overflow-wrap:normal]",
              VALUE_TONE[tone],
            )}
          >
            {headline}
          </p>
          {pct !== undefined ? <ProgressTrack value={pct} /> : null}
          {helper ? (
            <p className={cn("flex items-center gap-[5px] text-[12px] leading-[16px]", HELPER_TEXT[helperTone], pct !== undefined && "mt-[6px]")}>
              {helperTone !== "muted" ? <span className={cn("size-[5px] shrink-0 rounded-full", HELPER_DOT[helperTone])} /> : null}
              <span className={helperTone !== "muted" ? "font-medium" : undefined}>{helper}</span>
            </p>
          ) : null}
        </div>
      )}
    </OverviewCard>
  );
}

OverviewStatCard.displayName = "OverviewStatCard";
