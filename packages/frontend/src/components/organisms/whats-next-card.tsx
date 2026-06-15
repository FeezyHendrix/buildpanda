import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { HealthTrendChart } from "./charts/health-trend-chart";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import type { AiSuggestion } from "@/hooks/use-panda-ai";
import { cn } from "@/lib/utils";

interface WhatsNextCardProps {
  projectId: string;
}

export function WhatsNextCard({ projectId }: WhatsNextCardProps) {
  const { data, isLoading, isError } = useReportingSnapshot(projectId);

  if (isLoading) {
    return (
      <Card className="h-64 animate-pulse bg-gray-100/50" />
    );
  }

  if (isError || !data) {
    return (
      <Card className="flex h-32 items-center justify-center bg-gray-50/50 text-sm text-gray-500">
        Reporting temporarily unavailable
      </Card>
    );
  }

  const { health, operations } = data;
  const isEmpty = health.score === null && health.suggestions.length === 0;

  const getPriorityTone = (priority: AiSuggestion["priority"]) => {
    if (priority === "high") return "danger";
    if (priority === "medium") return "warning";
    return "info";
  };

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

  const getHealthColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 80) return "text-[#16A34A]";
    if (score >= 50) return "text-[#D97706]";
    return "text-[#DC2626]";
  };

  return (
    <Card className="flex flex-col overflow-hidden bg-white shadow-sm border border-[#EDEDED] rounded-[16px]">
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <div className="flex shrink-0 flex-col items-center justify-center p-6 sm:w-48">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Health Score
          </h3>
          <div className="mt-2 text-5xl font-bold tracking-tight">
            <span className={getHealthColor(health.score)}>
              {health.score ?? "--"}
            </span>
            <span className="text-xl text-gray-300">/100</span>
          </div>
        </div>

        <div className="flex-1 p-6">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Top Priorities
          </h3>
          {isEmpty ? (
            <p className="text-sm text-gray-500">
              Panda AI will analyse this project shortly.
            </p>
          ) : topSuggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {topSuggestions.map((suggestion, idx) => (
                <Link
                  key={idx}
                  to={getSuggestionLink(suggestion.category)}
                  className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge tone={getPriorityTone(suggestion.priority)} size="sm">
                      {suggestion.priority}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900 group-hover:text-[#004DE7]">
                      {suggestion.title}
                    </span>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-400 group-hover:text-[#004DE7]" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No urgent priorities right now.</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-gray-50/30 p-4">
        <div className="flex flex-wrap gap-2">
          <ChipLink
            to={`/project/${projectId}/action-items`}
            count={operations.dueActionItems}
            label="action items"
          />
          <ChipLink
            to={`/project/${projectId}/queries`}
            count={operations.openQueries}
            label="queries"
          />
          <ChipLink
            to={`/project/${projectId}/approvals`}
            count={operations.pendingApprovals}
            label="approvals"
          />
          <ChipLink
            to={`/project/${projectId}/permits`}
            count={operations.expiringPermits}
            label="permits"
          />
          <ChipLink
            to={`/project/${projectId}/key-dates`}
            count={operations.upcomingKeyDates}
            label="key dates"
          />
        </div>
      </div>

      {health.trendOldestFirst.length >= 2 && (
        <div className="border-t border-gray-100">
          <HealthTrendChart points={health.trendOldestFirst} compact />
        </div>
      )}

      <div className="border-t border-gray-100 p-4">
        <Link
          to={`/project/${projectId}/whats-next`}
          className="text-sm font-semibold text-[#004DE7] hover:underline"
        >
          See full What's Next &rarr;
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
        isZero
          ? "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
          : "border-[#004DE7]/20 bg-[#F0F5FF] text-[#004DE7] hover:bg-[#E6F0FF]"
      )}
    >
      <span className={cn("font-bold", !isZero && "text-[#004DE7]")}>{count}</span>
      {label}
    </Link>
  );
}
