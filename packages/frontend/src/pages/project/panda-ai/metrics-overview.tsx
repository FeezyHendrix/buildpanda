import { MetricCard } from "@/components/molecules/metric-card";
import type { Insight } from "@/hooks/use-panda-ai";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { HubFigure } from "./health-cards";

const DANGER = "text-error-600";

export function MetricsOverview({ insight, currency }: { insight: Insight; currency: string }) {
  const { metrics } = insight;
  if (!metrics) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Progress" value={<HubFigure>{`${Math.round(metrics.progressPercent)}%`}</HubFigure>} />
      <MetricCard
        label="Budget variance"
        value={
          <HubFigure className={cn(metrics.budgetVariance > 0 && DANGER)}>
            {formatCurrency(metrics.budgetVariance, currency)}
          </HubFigure>
        }
      />
      <MetricCard
        label="Outstanding invoiced"
        value={<HubFigure>{formatCurrency(metrics.outstandingInvoiced, currency)}</HubFigure>}
      />
      <MetricCard
        label="Overdue invoices"
        value={<HubFigure className={cn(metrics.overdueInvoiceCount > 0 && DANGER)}>{metrics.overdueInvoiceCount}</HubFigure>}
      />
      <MetricCard
        label="High risks"
        value={<HubFigure className={cn(metrics.highRiskCount > 0 && DANGER)}>{metrics.highRiskCount}</HubFigure>}
        helperText={`of ${metrics.openRiskCount} open`}
      />
      <MetricCard label="Pending inspections" value={<HubFigure>{metrics.pendingInspectionCount}</HubFigure>} />
      <MetricCard label="Pending phases" value={<HubFigure>{metrics.pendingPhaseCount}</HubFigure>} />
      <MetricCard label="Days since update" value={<HubFigure>{metrics.daysSinceLastUpdate ?? "--"}</HubFigure>} />
    </div>
  );
}

MetricsOverview.displayName = "MetricsOverview";
