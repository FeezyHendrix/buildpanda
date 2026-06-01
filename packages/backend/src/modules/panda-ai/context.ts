import type { Knex } from "knex";
import type { ProjectMetrics } from "./types.ts";

interface ProjectInfoRow {
  name: string;
  status: string;
  currency: string;
  progress_percent: number;
}

const RECENT_WINDOW_DAYS = 14;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(from: string, to: Date): number {
  const fromMs = new Date(from).getTime();
  if (Number.isNaN(fromMs)) return 0;
  return Math.floor((to.getTime() - fromMs) / 86_400_000);
}

export async function buildProjectMetrics(
  db: Knex,
  projectId: string,
): Promise<ProjectMetrics> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const recentCutoff = new Date(
    now.getTime() - RECENT_WINDOW_DAYS * 86_400_000,
  ).toISOString();

  const [
    project,
    phases,
    categories,
    invoices,
    paymentsAgg,
    risks,
    inspections,
    updates,
    latestUpdate,
    dailyLogs,
  ] = await Promise.all([
    db<ProjectInfoRow>("projects")
      .select("name", "status", "currency", "progress_percent")
      .where({ id: projectId })
      .first(),
    db("project_phases")
      .where({ project_id: projectId })
      .select("status"),
    db("project_budget_categories")
      .where({ project_id: projectId })
      .select("planned", "committed", "actual"),
    db("project_invoices")
      .where({ project_id: projectId })
      .select("amount", "status", "due_date"),
    db("invoice_payments")
      .join(
        "project_invoices",
        "invoice_payments.invoice_id",
        "project_invoices.id",
      )
      .where("project_invoices.project_id", projectId)
      .sum<{ total: string | null }>("invoice_payments.amount as total")
      .first(),
    db("risk_factors")
      .where({ project_id: projectId })
      .select("severity"),
    db("inspections")
      .where({ project_id: projectId })
      .select("status"),
    db("project_updates")
      .where({ project_id: projectId })
      .where("created_at", ">=", recentCutoff)
      .count<{ count: string }>("* as count")
      .first(),
    db("project_updates")
      .where({ project_id: projectId })
      .max<{ last: string | null }>("created_at as last")
      .first(),
    db("daily_logs")
      .where({ project_id: projectId })
      .where("created_at", ">=", recentCutoff)
      .count<{ count: string }>("* as count")
      .first(),
  ]);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const budgetPlanned = categories.reduce((sum, c) => sum + toNumber(c.planned), 0);
  const budgetCommitted = categories.reduce(
    (sum, c) => sum + toNumber(c.committed),
    0,
  );
  const budgetActual = categories.reduce((sum, c) => sum + toNumber(c.actual), 0);
  const overBudgetCategories = categories.filter(
    (c) => toNumber(c.actual) > toNumber(c.planned),
  ).length;

  const invoicedTotal = invoices.reduce((sum, i) => sum + toNumber(i.amount), 0);
  const paidTotal = toNumber(paymentsAgg?.total);
  const overdueInvoiceCount = invoices.filter(
    (i) =>
      i.status !== "Paid" &&
      typeof i.due_date === "string" &&
      i.due_date.length > 0 &&
      i.due_date < today,
  ).length;

  return {
    projectName: project.name,
    status: project.status,
    currency: project.currency,
    progressPercent: toNumber(project.progress_percent),
    phaseCount: phases.length,
    pendingPhaseCount: phases.filter((p) => p.status !== "Completed").length,
    budgetPlanned,
    budgetCommitted,
    budgetActual,
    budgetVariance: budgetActual - budgetPlanned,
    overBudgetCategories,
    invoiceCount: invoices.length,
    invoicedTotal,
    paidTotal,
    outstandingInvoiced: Math.max(invoicedTotal - paidTotal, 0),
    overdueInvoiceCount,
    openRiskCount: risks.length,
    highRiskCount: risks.filter((r) => r.severity === "High").length,
    inspectionCount: inspections.length,
    failedInspectionCount: inspections.filter(
      (i) => i.status === "Action Required",
    ).length,
    pendingInspectionCount: inspections.filter((i) => i.status === "Scheduled")
      .length,
    recentUpdateCount: toNumber(updates?.count),
    daysSinceLastUpdate: latestUpdate?.last
      ? daysBetween(latestUpdate.last, now)
      : null,
    recentDailyLogCount: toNumber(dailyLogs?.count),
  };
}
