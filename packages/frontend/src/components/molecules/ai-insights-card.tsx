import { type ReactNode } from "react";
import {
  AlertIcon,
  CheckIcon,
  GlobeIcon,
  TrendingUpIcon,
} from "@/components/atoms/project-nav-icons";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";

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
    <Card padding="md" className={className}>
      <header className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
          <GlobeIcon className="size-4" />
        </div>
        <p className="text-sm font-medium text-ink">{title}</p>
      </header>

      <p className="mt-2 max-w-md text-sm text-ink-muted text-pretty">
        {subtitle}
      </p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="flex items-start gap-3 rounded-lg border border-line-hair bg-surface-alt p-3"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-ink-muted">
              {ICON_BY_KIND[insight.kind]}
            </div>
            <p className="text-sm leading-snug text-ink text-pretty">
              {insight.message}
            </p>
          </li>
        ))}
      </ul>

      <Button type="button" variant="primary" size="md" className="mt-5" onClick={onCtaClick}>
        {ctaLabel}
      </Button>
    </Card>
  );
}

AiInsightsCard.displayName = "AiInsightsCard";

export {
  AiInsightsCard,
  type AiInsightsCardProps,
  type Insight as AiInsight,
};
