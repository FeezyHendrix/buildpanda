import type { Knex } from "knex";
import type { Currency } from "../projects/types.ts";
import { budgetRepository } from "../budget/repository.ts";
import { invoicesRepository } from "../invoices/repository.ts";
import { invoicesService } from "../invoices/service.ts";
import { pandaAiRepository } from "../panda-ai/repository.ts";
import { toInsight } from "../panda-ai/types.ts";
import type {
  BudgetCategoryPoint,
  CashFlowPoint,
  HealthPoint,
  InvoiceAgingBuckets,
  PhaseRef,
  ProjectReportingSnapshot,
} from "./types.ts";

const HEALTH_TREND_LIMIT = 30;
const RECENT_WINDOW_DAYS = 14;

function daysBetween(fromIso: string, to: Date): number | null {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) return null;
  return Math.floor((to.getTime() - fromMs) / 86_400_000);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function daysUntil(dueDate: string, today: string): number {
  const due = Date.parse(dueDate);
  const now = Date.parse(today);
  if (Number.isNaN(due) || Number.isNaN(now)) return Number.POSITIVE_INFINITY;
  return Math.floor((due - now) / 86_400_000);
}

interface ProjectInfoRow {
  name: string;
  status: string;
  currency: Currency;
  progress_percent: number;
}

interface PhaseRow {
  id: string;
  name: string;
  status: string;
  progress_percent: number;
  sort_order: number;
}

function toCashFlowCurve(
  periods: Array<{ period: string; planned: string; actual: string }>,
): CashFlowPoint[] {
  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  return periods.map((row) => {
    const planned = toNumber(row.planned);
    const actual = toNumber(row.actual);
    cumulativePlanned = round2(cumulativePlanned + planned);
    cumulativeActual = round2(cumulativeActual + actual);
    return {
      period: row.period,
      planned: round2(planned),
      actual: round2(actual),
      cumulativePlanned,
      cumulativeActual,
    };
  });
}

export function reportingService(db: Knex) {
  const budgetRepo = budgetRepository(db);
  const invoiceRepo = invoicesRepository(db);
  const invoices = invoicesService(invoiceRepo);
  const pandaAi = pandaAiRepository(db);

  async function buildSnapshot(
    projectId: string,
  ): Promise<ProjectReportingSnapshot> {
    const now = new Date();
    const generatedAt = now.toISOString();
    const today = generatedAt.slice(0, 10);
    const recentCutoff = new Date(
      now.getTime() - RECENT_WINDOW_DAYS * 86_400_000,
    ).toISOString();

    const [
      project,
      categories,
      periods,
      budgetDeltas,
      programmePhasing,
      invoiceList,
      milestoneAgg,
      escrowRow,
      changeApproved,
      changePending,
      phases,
      dueActionItems,
      blockedActionItems,
      openQueries,
      pendingApprovals,
      expiringPermits,
      upcomingKeyDates,
      riskOpen,
      riskHigh,
      latestInsight,
      trendRows,
      inspections,
      recentUpdates,
      latestUpdate,
      recentDailyLogs,
    ] = await Promise.all([
      db<ProjectInfoRow>("projects")
        .select("name", "status", "currency", "progress_percent")
        .where({ id: projectId })
        .first(),
      budgetRepo.listCategories(projectId),
      budgetRepo.listPeriods(projectId),
      budgetRepo.allocationDeltas(projectId),
      db("programme_cost_phasing")
        .where({ project_id: projectId })
        .where(
          "programme_version",
          db("programme_cost_phasing")
            .where({ project_id: projectId })
            .max("programme_version"),
        )
        .orderBy("period", "asc")
        .select<{ period: string; planned_cost: string }[]>(
          "period",
          "planned_cost",
        ),
      invoices.listByProject(projectId),
      db("milestone_payments")
        .where({ project_id: projectId })
        .select("status")
        .count<{ status: string; count: string }[]>("id as count")
        .groupBy("status"),
      db("project_finances")
        .where({ project_id: projectId })
        .select("locked_in_escrow")
        .first<{ locked_in_escrow: string } | undefined>(),
      db("change_requests")
        .where({ project_id: projectId, status: "Approved" })
        .sum<{ sum: string | null }>("cost_impact as sum")
        .first(),
      db("change_requests")
        .where({ project_id: projectId, status: "Submitted" })
        .sum<{ sum: string | null }>("cost_impact as sum")
        .first(),
      db<PhaseRow>("project_phases")
        .where({ project_id: projectId })
        .select("id", "name", "status", "progress_percent", "sort_order")
        .orderBy("sort_order", "asc"),
      db("action_items")
        .where({ project_id: projectId })
        .whereNot("status", "Resolved")
        .count<{ count: string }[]>("id as count")
        .first(),
      db("action_items")
        .where({ project_id: projectId, status: "Blocked" })
        .count<{ count: string }[]>("id as count")
        .first(),
      db("queries")
        .where({ project_id: projectId, status: "Open" })
        .count<{ count: string }[]>("id as count")
        .first(),
      db("approvals")
        .where({ project_id: projectId })
        .whereIn("status", ["Pending", "Resubmit"])
        .count<{ count: string }[]>("id as count")
        .first(),
      db("permits")
        .where({ project_id: projectId })
        .whereIn("status", ["Applied", "Expired"])
        .count<{ count: string }[]>("id as count")
        .first(),
      db("key_dates")
        .where({ project_id: projectId })
        .whereNot("status", "Met")
        .count<{ count: string }[]>("id as count")
        .first(),
      db("risk_factors")
        .where({ project_id: projectId })
        .count<{ count: string }[]>("id as count")
        .first(),
      db("risk_factors")
        .where({ project_id: projectId, severity: "High" })
        .count<{ count: string }[]>("id as count")
        .first(),
      pandaAi.latestForProject(projectId),
      db("project_ai_insights")
        .where({ project_id: projectId, status: "complete" })
        .whereNotNull("health_score")
        .orderBy("created_at", "desc")
        .limit(HEALTH_TREND_LIMIT)
        .select("health_score", "created_at"),
      db("inspections")
        .where({ project_id: projectId })
        .select("status")
        .count<{ status: string; count: string }[]>("id as count")
        .groupBy("status"),
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

    const deltaByCategory = new Map(
      budgetDeltas.map((d) => [d.budget_category_id, d]),
    );
    const categoryPoints: BudgetCategoryPoint[] = categories.map((c) => {
      const delta = deltaByCategory.get(c.id);
      const planned = round2(
        toNumber(c.planned) + (delta?.approved_change ?? 0),
      );
      const committed = round2(
        toNumber(c.committed) + (delta?.committed_change ?? 0),
      );
      const actual = round2(toNumber(c.actual) + (delta?.paid_invoice ?? 0));
      return {
        id: c.id,
        name: c.name,
        costCode: c.cost_code,
        planned,
        committed,
        actual,
        variance: round2(planned - actual),
      };
    });

    const totalPlanned = round2(
      categoryPoints.reduce((sum, c) => sum + c.planned, 0),
    );
    const totalCommitted = round2(
      categoryPoints.reduce((sum, c) => sum + c.committed, 0),
    );
    const totalActual = round2(
      categoryPoints.reduce((sum, c) => sum + c.actual, 0),
    );

    const invoicedTotal = round2(
      invoiceList.reduce((sum, i) => sum + i.totalInvoiced, 0),
    );
    const paidTotal = round2(
      invoiceList.reduce((sum, i) => sum + i.amountPaid, 0),
    );
    const retentionHeld = round2(
      invoiceList.reduce((sum, i) => sum + i.retentionAmount, 0),
    );

    const aging: InvoiceAgingBuckets = {
      current: 0,
      thirtyToSixty: 0,
      sixtyToNinety: 0,
      overNinety: 0,
    };
    let overdueCount = 0;
    for (const invoice of invoiceList) {
      if (invoice.status === "Paid" || invoice.balanceDue <= 0) continue;
      const balance = invoice.balanceDue;
      if (!invoice.dueDate) {
        aging.current += balance;
        continue;
      }
      const overdueDays = -daysUntil(invoice.dueDate, today);
      if (overdueDays > 0) overdueCount += 1;
      if (overdueDays <= 30) aging.current += balance;
      else if (overdueDays <= 60) aging.thirtyToSixty += balance;
      else if (overdueDays <= 90) aging.sixtyToNinety += balance;
      else aging.overNinety += balance;
    }
    aging.current = round2(aging.current);
    aging.thirtyToSixty = round2(aging.thirtyToSixty);
    aging.sixtyToNinety = round2(aging.sixtyToNinety);
    aging.overNinety = round2(aging.overNinety);

    const milestoneCount = (status: string): number =>
      toNumber(milestoneAgg.find((m) => m.status === status)?.count);

    const phasesInProgress: PhaseRef[] = phases
      .filter((p) => p.status === "InProgress")
      .map((p) => ({
        id: p.id,
        name: p.name,
        progressPercent: toNumber(p.progress_percent),
      }));
    const phasesUpcoming: PhaseRef[] = phases
      .filter((p) => p.status === "Pending")
      .map((p) => ({
        id: p.id,
        name: p.name,
        progressPercent: toNumber(p.progress_percent),
      }));

    const inspectionCount = (status: string): number =>
      toNumber(inspections.find((i) => i.status === status)?.count);
    const inspectionTotal = inspections.reduce(
      (sum, i) => sum + toNumber(i.count),
      0,
    );

    const latestUpdateAt = (latestUpdate as { last: string | null } | undefined)
      ?.last;

    const insight = latestInsight ? toInsight(latestInsight) : null;
    const trend: HealthPoint[] = trendRows
      .map((row) => ({
        at: new Date(
          (row as { created_at: Date | string }).created_at,
        ).toISOString(),
        score: toNumber((row as { health_score: number }).health_score),
      }))
      .reverse();

    return {
      projectId,
      generatedAt,
      currency: project.currency,
      projectName: project.name,
      status: project.status,
      finance: {
        budget: {
          totalPlanned,
          totalCommitted,
          totalActual,
          totalVariance: round2(totalPlanned - totalActual),
          totalRemaining: round2(totalPlanned - totalActual),
          categoryCount: categoryPoints.length,
          overBudgetCount: categoryPoints.filter((c) => c.actual > c.planned)
            .length,
          categories: categoryPoints,
        },
        cashFlow: { points: toCashFlowCurve(periods) },
        invoices: {
          count: invoiceList.length,
          invoicedTotal,
          paidTotal,
          outstanding: round2(Math.max(invoicedTotal - paidTotal, 0)),
          retentionHeld,
          overdueCount,
          aging,
        },
        milestones: {
          total: milestoneAgg.reduce((sum, m) => sum + toNumber(m.count), 0),
          completed: milestoneCount("Completed"),
          inProgress: milestoneCount("InProgress"),
          pending: milestoneCount("Pending"),
          lockedInEscrow: toNumber(escrowRow?.locked_in_escrow),
        },
        changeRequests: {
          approvedCostImpact: toNumber(changeApproved?.sum),
          pendingCostImpact: toNumber(changePending?.sum),
        },
      },
      schedule: {
        progressPercent: toNumber(project.progress_percent),
        phasesInProgress,
        phasesUpcoming,
        programmeCostCurve:
          programmePhasing.length > 0
            ? toCashFlowCurve(
                programmePhasing.map((p) => ({
                  period: p.period,
                  planned: p.planned_cost,
                  actual: "0",
                })),
              )
            : null,
      },
      operations: {
        dueActionItems: toNumber(dueActionItems?.count),
        blockedActionItems: toNumber(blockedActionItems?.count),
        openQueries: toNumber(openQueries?.count),
        pendingApprovals: toNumber(pendingApprovals?.count),
        expiringPermits: toNumber(expiringPermits?.count),
        upcomingKeyDates: toNumber(upcomingKeyDates?.count),
      },
      health: {
        score: insight?.healthScore ?? null,
        suggestions: insight?.suggestions ?? [],
        lastAnalyzedAt: insight?.createdAt ?? null,
        trendOldestFirst: trend,
      },
      risks: {
        open: toNumber(riskOpen?.count),
        high: toNumber(riskHigh?.count),
      },
      inspections: {
        total: inspectionTotal,
        failed: inspectionCount("Action Required"),
        pending: inspectionCount("Scheduled"),
      },
      activity: {
        recentUpdateCount: toNumber(
          (recentUpdates as { count: string } | undefined)?.count,
        ),
        daysSinceLastUpdate: latestUpdateAt
          ? daysBetween(latestUpdateAt, now)
          : null,
        recentDailyLogCount: toNumber(
          (recentDailyLogs as { count: string } | undefined)?.count,
        ),
        phaseCount: phases.length,
        pendingPhaseCount: phases.filter((p) => p.status !== "Done").length,
      },
    };
  }

  return { buildSnapshot };
}

export type ReportingService = ReturnType<typeof reportingService>;
