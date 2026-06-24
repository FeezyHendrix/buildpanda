import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { HealthTrendChart } from "./charts/health-trend-chart";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import type { AiSuggestion } from "@/hooks/use-panda-ai";
import { cn } from "@/lib/utils";

interface WhatsNextCardProps {
  projectId: string;
}

const PRIORITY_DOT: Record<AiSuggestion["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-primary",
};

function healthStroke(score: number | null): string {
  if (score === null) return "#D0D5DD";
  if (score >= 80) return "#16A34A";
  if (score >= 50) return "#D97706";
  return "#DC2626";
}

function HealthGauge({ score }: { score: number | null }) {
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circumference;
  const color = healthStroke(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EAECF0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-bold leading-none tracking-tight" style={{ color }}>
          {score ?? "--"}
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-black-300">out of 100</span>
      </div>
    </div>
  );
}

export function WhatsNextCard({ projectId }: WhatsNextCardProps) {
  const { data, isLoading, isError } = useReportingSnapshot(projectId);

  if (isLoading) {
    return <Card padding="lg" className="h-64 animate-pulse rounded-[16px] border-none bg-[#F8F8F8]" />;
  }

  if (isError || !data) {
    return (
      <Card
        padding="lg"
        className="flex h-32 items-center justify-center rounded-[16px] border-none bg-[#F8F8F8] text-sm text-black-300"
      >
        Reporting temporarily unavailable
      </Card>
    );
  }

  const { health, operations } = data;
  const isEmpty = health.score === null && health.suggestions.length === 0;

  const getSuggestionLink = (category: string) => {
    switch (category) {
      case "Budget":
        return `/project/${projectId}/budget`;
      case "Finance":
        return `/project/${projectId}/finances`;
      case "Schedule":
        return `/project/${projectId}/whats-next`;
      default:
        return `/project/${projectId}/panda-ai`;
    }
  };

  const topSuggestions = [...health.suggestions]
    .sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    })
    .slice(0, 3);

  return (
    <Card padding="lg" className="overflow-hidden rounded-[16px] border-none bg-[#F8F8F8] p-0">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col items-center justify-center gap-4 border-b border-[#EDEDED] p-7 lg:border-b-0 lg:border-r">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black-300">
            Health Score
          </p>
          <HealthGauge score={health.score} />
          {health.trendOldestFirst.length >= 2 && (
            <div className="w-full">
              <HealthTrendChart points={health.trendOldestFirst} compact />
            </div>
          )}
        </div>

        <div className="flex flex-col p-7">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-black-300">
            Top Priorities
          </p>
          {isEmpty ? (
            <div className="flex flex-1 items-center rounded-[12px] bg-white px-4 py-6 text-[13px] text-black-300">
              Panda AI will analyse this project shortly.
            </div>
          ) : topSuggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topSuggestions.map((suggestion, idx) => (
                <Link
                  key={idx}
                  to={getSuggestionLink(suggestion.category)}
                  className="group flex items-center justify-between rounded-[12px] bg-white px-4 py-3 ring-1 ring-transparent transition-all hover:ring-primary/20"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[suggestion.priority])} />
                    <span className="text-[13px] font-medium text-black-500 group-hover:text-primary">
                      {suggestion.title}
                    </span>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-black-200 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center rounded-[12px] bg-white px-4 py-6 text-[13px] text-black-300">
              No urgent priorities right now.
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <ChipLink to={`/project/${projectId}/action-items`} count={operations.dueActionItems} label="action items" />
            <ChipLink to={`/project/${projectId}/queries`} count={operations.openQueries} label="queries" />
            <ChipLink to={`/project/${projectId}/approvals`} count={operations.pendingApprovals} label="approvals" />
            <ChipLink to={`/project/${projectId}/permits`} count={operations.expiringPermits} label="permits" />
            <ChipLink to={`/project/${projectId}/key-dates`} count={operations.upcomingKeyDates} label="key dates" />
          </div>
        </div>
      </div>

      <div className="border-t border-[#EDEDED] px-7 py-3.5">
        <Link
          to={`/project/${projectId}/whats-next`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:gap-1.5"
        >
          See full What&rsquo;s Next
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

function ChipLink({ to, count, label }: { to: string; count: number; label: string }) {
  const isZero = count === 0;
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        isZero
          ? "bg-white text-black-200 hover:text-black-300"
          : "bg-primary/[0.08] text-primary hover:bg-primary/[0.12]",
      )}
    >
      <span className="font-bold tabular-nums">{count}</span>
      {label}
    </Link>
  );
}
