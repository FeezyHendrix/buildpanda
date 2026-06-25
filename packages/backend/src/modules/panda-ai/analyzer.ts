import type { AiInsightResult, AiSuggestion, ProjectMetrics } from "./types.ts";

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "NGN" ? "₦" : "";
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function analyzeMetrics(metrics: ProjectMetrics): AiInsightResult {
  const suggestions: AiSuggestion[] = [];
  let score = 100;

  if (metrics.budgetPlanned > 0 && metrics.budgetVariance > 0) {
    const overPct = (metrics.budgetVariance / metrics.budgetPlanned) * 100;
    score -= clamp(overPct, 0, 30);
    suggestions.push({
      title: "Spending is tracking over the planned budget",
      detail: `Actual cost (${formatMoney(metrics.budgetActual, metrics.currency)}) exceeds the plan (${formatMoney(metrics.budgetPlanned, metrics.currency)}) by ${formatMoney(metrics.budgetVariance, metrics.currency)} (${overPct.toFixed(1)}%). Review the ${metrics.overBudgetCategories} over-budget cost ${metrics.overBudgetCategories === 1 ? "category" : "categories"} and re-baseline or issue a change request.`,
      priority: overPct > 10 ? "high" : "medium",
      category: "Budget",
    });
  } else if (metrics.overBudgetCategories > 0) {
    score -= 5;
    suggestions.push({
      title: `${metrics.overBudgetCategories} cost ${metrics.overBudgetCategories === 1 ? "category is" : "categories are"} over budget`,
      detail:
        "Individual line items have exceeded their planned amounts even though the overall budget is intact. Rebalance allocations before the overrun spreads.",
      priority: "medium",
      category: "Budget",
    });
  }

  if (metrics.overdueInvoiceCount > 0) {
    score -= clamp(metrics.overdueInvoiceCount * 4, 0, 20);
    suggestions.push({
      title: `${metrics.overdueInvoiceCount} invoice${metrics.overdueInvoiceCount === 1 ? " is" : "s are"} past due`,
      detail: `There ${metrics.overdueInvoiceCount === 1 ? "is" : "are"} ${metrics.overdueInvoiceCount} unpaid invoice${metrics.overdueInvoiceCount === 1 ? "" : "s"} past the due date, with ${formatMoney(metrics.outstandingInvoiced, metrics.currency)} still outstanding. Prioritise payment or renegotiate terms to protect contractor relationships.`,
      priority: "high",
      category: "Finance",
    });
  } else if (metrics.outstandingInvoiced > 0) {
    suggestions.push({
      title: "Outstanding invoiced amount to monitor",
      detail: `${formatMoney(metrics.outstandingInvoiced, metrics.currency)} has been invoiced but not yet paid. Keep cash flow scheduled so none of it slips past due.`,
      priority: "low",
      category: "Finance",
    });
  }

  if (metrics.highRiskCount > 0) {
    score -= clamp(metrics.highRiskCount * 6, 0, 24);
    suggestions.push({
      title: `${metrics.highRiskCount} high-severity risk${metrics.highRiskCount === 1 ? "" : "s"} open`,
      detail: `Mitigation plans should be assigned for the ${metrics.highRiskCount} high-severity risk${metrics.highRiskCount === 1 ? "" : "s"} currently logged. Unowned high risks are the most common cause of schedule slippage.`,
      priority: "high",
      category: "Risk",
    });
  }

  if (metrics.failedInspectionCount > 0) {
    score -= clamp(metrics.failedInspectionCount * 5, 0, 20);
    suggestions.push({
      title: `${metrics.failedInspectionCount} inspection${metrics.failedInspectionCount === 1 ? " needs" : "s need"} action`,
      detail: `${metrics.failedInspectionCount} inspection${metrics.failedInspectionCount === 1 ? " is" : "s are"} marked "Action Required". Resolve the findings and re-inspect before they block downstream work.`,
      priority: "high",
      category: "Quality",
    });
  }

  if (metrics.daysSinceLastUpdate === null) {
    score -= 8;
    suggestions.push({
      title: "No progress updates posted yet",
      detail:
        "There are no site updates on record. Posting regular updates keeps stakeholders informed and creates an auditable progress trail.",
      priority: "medium",
      category: "Communication",
    });
  } else if (metrics.daysSinceLastUpdate > 7) {
    score -= clamp(metrics.daysSinceLastUpdate, 0, 12);
    suggestions.push({
      title: "Progress updates are going stale",
      detail: `The last update was ${metrics.daysSinceLastUpdate} days ago. Aim for at least a weekly update so the timeline reflects real site conditions.`,
      priority: "medium",
      category: "Communication",
    });
  }

  if (metrics.recentDailyLogCount === 0) {
    score -= 4;
    suggestions.push({
      title: "No recent daily logs",
      detail:
        "No daily logs were recorded in the last two weeks. Daily logs are critical evidence for delay claims and labour tracking.",
      priority: "low",
      category: "Documentation",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: "Project is on a healthy track",
      detail:
        "No budget overruns, overdue invoices, high risks, or stale updates were detected. Maintain the current cadence of updates and inspections.",
      priority: "low",
      category: "General",
    });
  }

  const healthScore = Math.round(clamp(score, 0, 100));
  const headline =
    healthScore >= 80
      ? "is in good shape"
      : healthScore >= 60
        ? "needs attention in a few areas"
        : "has several issues that need immediate attention";

  const summary = `${metrics.projectName} ${headline}. Progress is at ${metrics.progressPercent}% with ${metrics.pendingPhaseCount} of ${metrics.phaseCount} phases still pending. ${suggestions.length === 1 && suggestions[0]?.category === "General" ? "No pressing issues were found." : `Top focus: ${suggestions[0]?.title.toLowerCase()}.`}`;

  return {
    summary,
    suggestions,
    healthScore,
    model: "panda-rules-v1",
  };
}
