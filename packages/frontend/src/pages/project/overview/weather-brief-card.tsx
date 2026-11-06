import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import type { WeatherAnalysis } from "@/hooks/use-weather";
import { cn } from "@/lib/utils";
import { SectionEyebrow } from "./overview-card";

const NO_WORK = "No work scheduled";

const RISK_TEXT: Record<NonNullable<WeatherAnalysis["riskLevel"]>, string> = {
  low: "text-[#00A63E]",
  medium: "text-[#E17100]",
  high: "text-[#E7000B]",
};

function ImpactBox({ title, text }: { title: string; text: string | null }) {
  return (
    <div className="min-w-0 border border-[#EEEEEE] px-[14px] pb-[12px] pt-[12px]">
      <p className="text-[14px] leading-[20px] text-[#1E1E1E]">{title}</p>
      <p className={cn("mt-[2px] text-[12px] leading-[16px]", text ? "text-[#737373]" : "text-[#A3A3A3]")}>{text ?? NO_WORK}</p>
    </div>
  );
}

function BriefBanner({ analysis }: { analysis: WeatherAnalysis | undefined }) {
  const risk = analysis?.riskLevel;
  return (
    <div className="bg-primary px-[14px] pb-[20px] pt-[24px]">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-[8px] text-[11px] font-medium uppercase leading-[16px] tracking-[0.2em] text-[#B8CCFF]">
          <Sparkles className="size-[16px] fill-[#FFD43B] text-[#FFD43B]" aria-hidden />
          Panda AI Weather Brief
        </p>
        {risk ? (
          <span
            className={cn(
              "inline-flex h-[22px] items-center rounded-full border border-[#D6EFE0] bg-white px-[9px] text-[11px] font-bold uppercase",
              RISK_TEXT[risk],
            )}
          >
            {risk} risk
          </span>
        ) : null}
      </div>
      {analysis?.available ? (
        <>
          {analysis.headline ? (
            <h3 className="mt-[14px] text-[20px] font-semibold leading-[28px] text-white">{analysis.headline}</h3>
          ) : null}
          {analysis.impact ? <p className="mt-[2px] text-[14px] leading-[20px] text-[#B8CCFF]">{analysis.impact}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function Recommendations({ items }: { items: string[] }) {
  return (
    <div className="mt-[25px]">
      <SectionEyebrow>Recommended actions</SectionEyebrow>
      <ol className="mt-[4px]">
        {items.map((rec, idx) => (
          <li key={rec} className="flex items-center gap-[12px] border-b border-[#EEEEEE] py-[11px] last:border-b-0">
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
              {idx + 1}
            </span>
            <p className="text-[14px] leading-[20px] text-[#1E1E1E]">{rec}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WeatherBriefCard({ analysis, isLoading }: { analysis: WeatherAnalysis | undefined; isLoading: boolean }) {
  return (
    <section aria-label="Panda AI weather brief" className="flex min-w-0 flex-col border border-[#EEEEEE] bg-white">
      <BriefBanner analysis={analysis} />
      <div className="flex-1 px-[14px] pb-[8px] pt-[16px]">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Spinner size="sm" />
          </div>
        ) : analysis?.available ? (
          <>
            <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
              <ImpactBox title="Schedule Impact" text={analysis.scheduleImpact} />
              <ImpactBox title="Cost Impact" text={analysis.costImpact} />
            </div>
            {analysis.recommendations.length > 0 ? <Recommendations items={analysis.recommendations} /> : null}
          </>
        ) : (
          <EmptyState
            title="No weather-affected activities today"
            description="Weather analysis is unavailable right now."
            variant="inline"
          />
        )}
      </div>
    </section>
  );
}

WeatherBriefCard.displayName = "WeatherBriefCard";
