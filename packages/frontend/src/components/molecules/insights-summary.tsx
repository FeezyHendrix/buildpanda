import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { useProjectInsights } from "@/hooks/use-insights";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

interface Props {
  projectId: string;
}

function InsightsSummary({ projectId }: Props) {
  const { data, isLoading } = useProjectInsights(projectId);
  if (isLoading || !data) return null;

  const openTotal = data.openItems.actionItems + data.openItems.queries + data.openItems.awaitingApproval;
  const riskTotal =
    data.scheduleRisk.permitsAtRisk + data.scheduleRisk.missedKeyDates + data.scheduleRisk.blockedItems;

  const tiles = [
    {
      label: "Stage progress",
      value: `${data.progress.overallPercent}%`,
      hint: `${data.progress.stagesComplete}/${data.progress.stagesTotal} stages complete`,
      to: `/project/${projectId}/stages`,
    },
    {
      label: "Open items",
      value: String(openTotal),
      hint: `${data.openItems.actionItems} actions · ${data.openItems.queries} queries · ${data.openItems.awaitingApproval} approvals`,
      to: `/project/${projectId}/action-items`,
    },
    {
      label: "Budget remaining",
      value: money(data.budget.remaining, data.budget.currency),
      hint:
        data.budget.approvedChangeCost > 0
          ? `+${money(data.budget.approvedChangeCost, data.budget.currency)} approved changes`
          : `${money(data.budget.released, data.budget.currency)} released`,
      to: `/project/${projectId}/finances`,
    },
    {
      label: "Schedule risk",
      value: String(riskTotal),
      hint: `${data.scheduleRisk.permitsAtRisk} permits · ${data.scheduleRisk.missedKeyDates} missed dates · ${data.scheduleRisk.blockedItems} blocked`,
      to: `/project/${projectId}/whats-next`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <Link key={t.label} to={t.to}>
          <Card padding="md" interactive className="flex h-full flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{t.label}</span>
            <span className="text-xl font-bold text-gray-900">{t.value}</span>
            <span className="text-[11px] leading-tight text-gray-400">{t.hint}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

InsightsSummary.displayName = "InsightsSummary";

export { InsightsSummary };
