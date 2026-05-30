import { type ReactNode } from "react";
import {
  AlertIcon,
  CheckIcon,
  GlobeIcon,
  TrendingUpIcon,
} from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";

type InsightKind = "trend" | "good" | "warning";

interface Insight {
  id: string;
  kind: InsightKind;
  message: string;
}

interface AiInsightsCardProps {
  title?: string;
  subtitle?: string;
  insights: Insight[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

const ICON_BY_KIND: Record<InsightKind, ReactNode> = {
  trend: <TrendingUpIcon className="size-4" />,
  good: <CheckIcon className="size-4" />,
  warning: <AlertIcon className="size-4" />,
};

function AiInsightsCard({
  title = "Build Panda AI",
  subtitle = "Smart analysis of your current financial velocity and market conditions.",
  insights,
  ctaLabel = "Ask AI About My Spending",
  onCtaClick,
  className,
}: AiInsightsCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-white",
        "bg-gradient-to-br from-[#1A4AD9] via-[#004DE7] to-[#0036A8]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 size-72 rounded-full bg-white/5 blur-2xl" />

      <header className="relative flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-white/15">
          <GlobeIcon className="size-4" />
        </div>
        <p className="text-sm font-semibold tracking-wide">{title}</p>
      </header>

      <p className="relative mt-2 max-w-md text-sm text-white/80 text-pretty">
        {subtitle}
      </p>

      <ul className="relative mt-5 flex flex-col gap-2.5">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="flex items-start gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20">
              {ICON_BY_KIND[insight.kind]}
            </div>
            <p className="text-sm leading-snug text-white/95 text-pretty">
              {insight.message}
            </p>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCtaClick}
        className={cn(
          "relative mt-5 inline-flex h-10 items-center justify-center rounded-full bg-white px-5",
          "text-sm font-semibold text-[#004DE7] transition-colors",
          "outline-none hover:bg-white/95 focus-visible:ring-2 focus-visible:ring-white",
        )}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

AiInsightsCard.displayName = "AiInsightsCard";

export {
  AiInsightsCard,
  type AiInsightsCardProps,
  type Insight as AiInsight,
};
