import { type ReactNode } from "react";
import { HealthTrendChart } from "@/components/organisms/charts/health-trend-chart";
import { MetricCard } from "@/components/molecules/metric-card";
import type { HealthPoint } from "@/hooks/use-reporting-snapshot";
import { cn } from "@/lib/utils";

/** A hub figure reads larger and lighter than a MetricCard's default value. */
export function HubFigure({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block py-1 text-2xl font-medium", className)}>{children}</span>;
}

HubFigure.displayName = "HubFigure";

function scoreTone(score: number | null): string {
  if (score === null) return "text-black-500";
  if (score >= 80) return "text-primary";
  if (score >= 50) return "text-warning-500";
  return "text-negative-500";
}

export function HealthScoreCard({ score }: { score: number | null }) {
  return (
    <MetricCard
      label="Health Score"
      value={<HubFigure className={scoreTone(score)}>{score !== null ? score : "--"}</HubFigure>}
      helperText="0-100 score based on project metrics"
    />
  );
}

HealthScoreCard.displayName = "HealthScoreCard";

export function SummaryCard({ summary }: { summary: string | null }) {
  return (
    <MetricCard
      label="AI Summary"
      value={
        <span className="block whitespace-pre-wrap py-1 text-base font-normal leading-5 text-gray-500">
          {summary || "No summary provided."}
        </span>
      }
    />
  );
}

SummaryCard.displayName = "SummaryCard";

export function HealthTrendCard({ points }: { points: HealthPoint[] }) {
  return (
    <section aria-label="Health trend" className="border-[0.5px] border-[#EBEBEB] bg-white p-6">
      <h2 className="border-b border-[#EBEBEB] pb-2 text-caption-l! font-semibold text-black-500">
        Health Trend
      </h2>
      <HealthTrendChart points={points} />
    </section>
  );
}

HealthTrendCard.displayName = "HealthTrendCard";
