import { useProjectContext } from "@/layouts/project-layout";
import {
  useLatestInsight,
  useAnalyzeProject,
  type Insight,
  type AiSuggestion,
} from "@/hooks/use-panda-ai";
import { PageHeader } from "@/components/molecules/page-header";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { Card } from "@/components/atoms/card";
import { KpiCard } from "@/components/molecules/kpi-card";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { HealthTrendChart } from "@/components/organisms/charts/health-trend-chart";

function HealthScoreCard({ score }: { score: number | null }) {
  const healthColor =
    score === null
      ? "text-gray-900"
      : score >= 80
        ? "text-[#16A34A]"
        : score >= 50
          ? "text-[#D97706]"
          : "text-[#DC2626]";

  return (
    <Card
      className="flex flex-col items-center justify-center text-center"
      padding="lg"
    >
      <h2 className="text-sm font-medium text-gray-500">Health Score</h2>
      <div className={cn("mt-2 text-6xl font-bold", healthColor)}>
        {score !== null ? score : "--"}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        0-100 score based on project metrics
      </p>
    </Card>
  );
}

function SuggestionsList({ suggestions }: { suggestions: AiSuggestion[] }) {
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  const sortedSuggestions = [...suggestions].sort(
    (a, b) => priorityWeight[b.priority] - priorityWeight[a.priority],
  );

  if (sortedSuggestions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-500">
          No suggestions available at this time.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {sortedSuggestions.map((sugg, i) => {
        const badgeClass =
          sugg.priority === "high"
            ? "bg-red-100 text-red-800"
            : sugg.priority === "medium"
              ? "bg-amber-100 text-amber-800"
              : "bg-blue-100 text-blue-800";

        return (
          <Card key={i} className="flex flex-col space-y-2">
            <div className="flex items-center space-x-3">
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                  badgeClass,
                )}
              >
                {sugg.priority}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {sugg.category}
              </span>
            </div>
            <h3 className="font-bold text-gray-900">{sugg.title}</h3>
            <p className="text-sm text-gray-600">{sugg.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}

function MetricsOverview({
  insight,
  currency,
}: {
  insight: Insight;
  currency: string;
}) {
  const { metrics } = insight;
  if (!metrics) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Progress" progress={metrics.progressPercent} />
      <KpiCard
        label="Budget variance"
        value={formatCurrency(metrics.budgetVariance, currency)}
        tone={metrics.budgetVariance > 0 ? "danger" : undefined}
      />
      <KpiCard label="Outstanding invoiced" value={formatCurrency(metrics.outstandingInvoiced, currency)} />
      <KpiCard
        label="Overdue invoices"
        value={metrics.overdueInvoiceCount}
        tone={metrics.overdueInvoiceCount > 0 ? "danger" : undefined}
      />
      <KpiCard
        label="High risks"
        value={metrics.highRiskCount}
        helper={`of ${metrics.openRiskCount} open`}
        tone={metrics.highRiskCount > 0 ? "danger" : undefined}
      />
      <KpiCard label="Pending inspections" value={metrics.pendingInspectionCount} />
      <KpiCard label="Pending phases" value={metrics.pendingPhaseCount} />
      <KpiCard label="Days since update" value={metrics.daysSinceLastUpdate ?? "--"} />
    </div>
  );
}

export default function ProjectPandaAi() {
  const { project } = useProjectContext();
  const { data: insight, isPending } = useLatestInsight(project.id);
  const { data: reportingData } = useReportingSnapshot(project.id);
  const analyze = useAnalyzeProject();

  function handleAnalyze() {
    analyze.mutate(project.id);
  }

  const isAnalyzing =
    analyze.isPending ||
    insight?.status === "pending" ||
    insight?.status === "processing" ||
    (!insight && isPending);

  return (
    <div className="w-full px-6 pb-24">
      <PageHeader
        title="Panda AI"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            Run analysis
          </Button>
        }
      />

      {isAnalyzing ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-4">
          <Spinner size="md" />
          <p className="text-sm text-gray-500">
            Panda AI is analyzing project data...
          </p>
        </div>
      ) : !insight ? (
        <EmptyState
          title="No analysis yet"
          description="Run your first Panda AI analysis to get prioritized suggestions and health metrics."
          action={{ label: "Run first analysis", onClick: handleAnalyze }}
        />
      ) : insight.status === "failed" ? (
        <EmptyState
          title="Analysis failed"
          description={
            insight.error || "An error occurred while generating the analysis."
          }
          action={{ label: "Try again", onClick: handleAnalyze }}
        />
      ) : (
        <div className="mt-8 grid gap-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-6">
              <HealthScoreCard score={insight.healthScore} />
              {reportingData && reportingData.health.trendOldestFirst.length >= 2 && (
                <Card className="flex flex-col p-6">
                  <h2 className="text-sm font-medium text-gray-500 mb-4 text-center">Health Trend</h2>
                  <HealthTrendChart points={reportingData.health.trendOldestFirst} />
                </Card>
              )}
            </div>
            <Card className="col-span-1 flex flex-col md:col-span-2 p-6">
              <h2 className="font-semibold text-gray-900">AI Summary</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {insight.summary || "No summary provided."}
              </p>
            </Card>
          </div>

          <MetricsOverview insight={insight} currency={project.currency} />

          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Prioritized Suggestions
            </h2>
            <SuggestionsList suggestions={insight.suggestions} />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <p>
              {insight.model ? `Generated by ${insight.model}` : "AI Analysis"}
            </p>
            <p>Last updated: {new Date(insight.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
