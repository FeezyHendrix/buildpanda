import type { Knex } from "knex";
import { reportingService } from "../reporting/service.ts";
import type { ProjectMetrics } from "./types.ts";

export async function buildProjectMetrics(
  db: Knex,
  projectId: string,
): Promise<ProjectMetrics> {
  const snapshot = await reportingService(db).buildSnapshot(projectId);
  const { finance, schedule, risks, inspections, activity } = snapshot;
  const budgetActual = finance.budget.totalActual;
  const budgetPlanned = finance.budget.totalPlanned;

  return {
    projectName: snapshot.projectName,
    status: snapshot.status,
    currency: snapshot.currency,
    progressPercent: schedule.progressPercent,
    phaseCount: activity.phaseCount,
    pendingPhaseCount: activity.pendingPhaseCount,
    budgetPlanned,
    budgetCommitted: finance.budget.totalCommitted,
    budgetActual,
    budgetVariance: budgetActual - budgetPlanned,
    overBudgetCategories: finance.budget.overBudgetCount,
    invoiceCount: finance.invoices.count,
    invoicedTotal: finance.invoices.invoicedTotal,
    paidTotal: finance.invoices.paidTotal,
    outstandingInvoiced: finance.invoices.outstanding,
    overdueInvoiceCount: finance.invoices.overdueCount,
    openRiskCount: risks.open,
    highRiskCount: risks.high,
    inspectionCount: inspections.total,
    failedInspectionCount: inspections.failed,
    pendingInspectionCount: inspections.pending,
    recentUpdateCount: activity.recentUpdateCount,
    daysSinceLastUpdate: activity.daysSinceLastUpdate,
    recentDailyLogCount: activity.recentDailyLogCount,
  };
}
