import type { Knex } from "knex";
import type { Currency } from "../projects/types.ts";
import { budgetRepository } from "../budget/repository.ts";
import { financesRepository } from "../finances/repository.ts";
import { stageBudgetLines } from "../finances/finance-summary.ts";
import { stageCostsService } from "../finances/stage-costs.ts";
import { purchaseOrdersRepository } from "../purchase-orders/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import { transactionsRepository } from "../transactions/repository.ts";
import { invoicesRepository } from "../invoices/repository.ts";
import { invoicesService } from "../invoices/service.ts";
import { pandaAiRepository } from "../panda-ai/repository.ts";
import { toInsight } from "../panda-ai/types.ts";
import {
  cashFlowCurve,
  hasStageFigures,
  stageBudgetPoints,
  sumByPeriod,
} from "./finance-position.ts";
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
  const stagesRepo = stagesRepository(db);
  // Only the priced billing-sheet months are wanted here, which is all this
  // narrow wiring of the stages service can answer.
  const stages = stagesService(stagesRepo, async () => undefined);
  const transactionsRepo = transactionsRepository(db);
  // The overview must answer with the same money the finance pages publish, so
  // it reads the stage cost model rather than the hand-kept budget sheet.
  const stageCosts = stageCostsService({
    finances: financesRepository(db),
    transactions: transactionsRepo,
    purchaseOrders: purchaseOrdersRepository(db),
  });

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
      pendingApprovals,
      expiringPermits,
      overdueActivities,
      upcomingKeyDates,
      missedKeyDates,
      riskOpen,
      riskHigh,
      latestInsight,
      trendRows,
      inspections,
      recentUpdates,
      latestUpdate,
      recentDailyLogs,
      lateMaterialOrders,
      pendingMaterialApprovals,
      projectDates,
      eotPosition,
      delayedActivities,
      timelineShift,
      overdueRfis,
      overdueTasks,
      expiredPermits,
      expiringSoonPermits,
      stageRows,
      stageCostRows,
      monthlyActual,
      sovLines,
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
        .select("retention_held")
        .first<{ retention_held: string } | undefined>(),
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
      db("approvals")
        .where({ project_id: projectId, kind: "client" })
        .whereIn("status", ["Pending", "Resubmit"])
        .count<{ count: string }[]>("id as count")
        .first(),
      db("permits")
        .where({ project_id: projectId })
        .whereIn("status", ["Applied", "Expired"])
        .count<{ count: string }[]>("id as count")
        .first(),
      db("activities")
        .where({ project_id: projectId })
        .whereIn("status", ["Planned", "InProgress"])
        .where("planned_end_at", "<", db.fn.now())
        .count<{ count: string }[]>("id as count")
        .first(),
      db("key_dates")
        .where({ project_id: projectId })
        .whereNot("status", "Met")
        .count<{ count: string }[]>("id as count")
        .first(),
      db("key_dates")
        .where({ project_id: projectId })
        .where((q) =>
          q
            .where("status", "Missed")
            .orWhere((qq) =>
              qq.where("status", "Upcoming").andWhere("target_date", "<", db.fn.now()),
            ),
        )
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
      // Late is computed from the dates, never a stored status: wanted before
      // today and not delivered, or promised after it was wanted.
      db("material_orders")
        .where({ project_id: projectId })
        .whereNotIn("status", ["Delivered", "Cancelled", "Rejected"])
        .where((q) =>
          q
            .where("needed_by", "<", db.raw("to_char(now(), 'YYYY-MM-DD')"))
            .orWhereRaw("expected_delivery_at IS NOT NULL AND expected_delivery_at > needed_by"),
        )
        .count<{ count: string }[]>("id as count")
        .first(),
      db("approvals")
        .where({ project_id: projectId, kind: "material" })
        .whereIn("status", ["Pending", "Resubmit"])
        .count<{ count: string }[]>("id as count")
        .first(),
      db("projects")
        .where({ id: projectId })
        .select("completion_date", "revised_completion_date")
        .first<{ completion_date: string | null; revised_completion_date: string | null } | undefined>(),
      // A time claim is a change request of type eot_only; the retired EOT
      // register is no longer read.
      db("change_requests")
        .where({ project_id: projectId, type: "eot_only" })
        .select<Array<{ status: string; time_impact_days: number; days_awarded: number | null }>>(
          "status",
          "time_impact_days",
          "days_awarded",
        ),
      // Activities carrying an OPEN delay, with the time booked against them —
      // "9 delayed activities" meant nothing without the days.
      db("activity_delays as d")
        .join("activities as a", "a.id", "d.activity_id")
        .where("a.project_id", projectId)
        .whereNull("d.resolved_at")
        .first<{ activities: string; days: string | null } | undefined>(
          db.raw("count(DISTINCT d.activity_id) as activities"),
          db.raw("COALESCE(SUM(d.days_lost), 0) as days"),
        ),
      // How far the projected finish has moved from the baseline programme.
      db("activities")
        .where({ project_id: projectId })
        .whereNotNull("baseline_end_at")
        .first<{ shift: string | null } | undefined>(
          db.raw(
            "MAX(EXTRACT(EPOCH FROM (planned_end_at - baseline_end_at)) / 86400) as shift",
          ),
        ),
      db("rfis")
        .where({ project_id: projectId })
        .whereNotIn("status", ["Answered", "Closed", "Void", "Draft"])
        .whereNotNull("due_date")
        .where("due_date", "<", db.raw("CURRENT_DATE"))
        .count<{ count: string }[]>("id as count")
        .first(),
      db("tasks as t")
        .join("task_columns as c", "c.id", "t.column_id")
        .where("t.project_id", projectId)
        .whereNot("c.status", "Done")
        .whereNotNull("t.due_date")
        .where("t.due_date", "<", db.raw("CURRENT_DATE"))
        .count<{ count: string }[]>("t.id as count")
        .first(),
      db("permits")
        .where({ project_id: projectId })
        .where((q) =>
          q
            .where("status", "Expired")
            .orWhere((qq) =>
              qq
                .whereNot("status", "Rejected")
                .whereNotNull("expiry_date")
                .where("expiry_date", "<", db.raw("CURRENT_DATE")),
            ),
        )
        .count<{ count: string }[]>("id as count")
        .first(),
      db("permits")
        .where({ project_id: projectId })
        .whereNotIn("status", ["Expired", "Rejected"])
        .whereNotNull("expiry_date")
        .where("expiry_date", ">=", db.raw("CURRENT_DATE"))
        .where("expiry_date", "<=", db.raw("CURRENT_DATE + 30"))
        .count<{ count: string }[]>("id as count")
        .first(),
      stagesRepo.listByProject(projectId),
      stageCosts.byProject(projectId).catch(() => ({ stages: [] })),
      transactionsRepo.sumByMonth(projectId),
      stages.listScheduleOfValues(projectId).catch(() => []),
    ]);

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const deltaByCategory = new Map(
      budgetDeltas.map((d) => [d.budget_category_id, d]),
    );
    const sheetPoints: BudgetCategoryPoint[] = categories.map((c) => {
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

    // Cost is recorded against stages, so the stage lines are the real budget
    // position. The hand-kept budget sheet is only the fallback, for a project
    // that keeps its costs there and has no stage figures at all.
    const stagePoints = stageBudgetPoints(
      stageBudgetLines(
        stageRows.map((row) => ({
          stageId: row.id,
          name: row.name,
          scheduledValue: toNumber(row.value),
          expectedCost: toNumber(row.expected_cost ?? 0),
        })),
        new Map(
          stageCostRows.stages.map((c) => [
            c.stageId,
            { committed: c.committed, actual: c.actual },
          ]),
        ),
      ),
    );
    const categoryPoints = hasStageFigures(stagePoints) ? stagePoints : sheetPoints;

    /*
     * The S-curve: what the job is meant to bill each month against what it has
     * actually cost. Planned comes from the billing sheet the QS keeps (the
     * priced schedule of values), falling back to the programme's cost phasing
     * and then to the hand-entered cash-flow periods. Actual is the expense
     * ledger by month, on the same credit rules as the stage figures — both are
     * records of money moved off-platform, never movements made here.
     */
    const plannedMonths = sumByPeriod(
      sovLines.length > 0
        ? sovLines.map((line) => ({ period: line.period, amount: toNumber(line.periodAmount) }))
        : programmePhasing.length > 0
          ? programmePhasing.map((p) => ({ period: p.period, amount: toNumber(p.planned_cost) }))
          : periods.map((row) => ({ period: row.period, amount: toNumber(row.planned) })),
    );
    const actualMonths = sumByPeriod([
      ...monthlyActual.map((row) => ({ period: row.month, amount: toNumber(row.total) })),
      // A project that keeps its cash flow by hand still gets its actuals drawn.
      ...(monthlyActual.length === 0
        ? periods.map((row) => ({ period: row.period, amount: toNumber(row.actual) }))
        : []),
    ]);
    const cashFlow = cashFlowCurve(plannedMonths, actualMonths);

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

    // Awarded days survive execution, so an executed claim still counts as time
    // won; only a claim still awaiting a decision counts as pending.
    const eotDays = { approved: 0, pending: 0 };
    for (const claim of eotPosition) {
      if (claim.status === "Approved" || claim.status === "Executed") {
        eotDays.approved += toNumber(claim.days_awarded);
      } else if (claim.status === "Submitted") {
        eotDays.pending += toNumber(claim.time_impact_days);
      }
    }

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
        cashFlow: { points: cashFlow },
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
          lockedInEscrow: toNumber(escrowRow?.retention_held),
        },
        changeRequests: {
          approvedCostImpact: toNumber(changeApproved?.sum),
          pendingCostImpact: toNumber(changePending?.sum),
        },
      },
      schedule: {
        completionDate: projectDates?.completion_date ?? null,
        revisedCompletionDate: projectDates?.revised_completion_date ?? null,
        eotDaysApproved: eotDays.approved,
        eotDaysPending: eotDays.pending,
        // Needs the contract's LD rate and cap, which arrive with the contract
        // terms; a made-up figure here would be a claim, not a report.
        ldExposure: null,
        delayedActivities: {
          count: toNumber(delayedActivities?.activities),
          daysLost: toNumber(delayedActivities?.days),
        },
        timelineShiftDays: Math.round(toNumber(timelineShift?.shift)),
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
        pendingApprovals: toNumber(pendingApprovals?.count),
        expiringPermits: toNumber(expiringPermits?.count),
        overdueActivities: toNumber(overdueActivities?.count),
        upcomingKeyDates: toNumber(upcomingKeyDates?.count),
        missedKeyDates: toNumber(missedKeyDates?.count),
        lateMaterialOrders: toNumber(lateMaterialOrders?.count),
        pendingMaterialApprovals: toNumber(pendingMaterialApprovals?.count),
        overdueRfis: toNumber(overdueRfis?.count),
        overdueTasks: toNumber(overdueTasks?.count),
        expiredPermits: toNumber(expiredPermits?.count),
        expiringSoonPermits: toNumber(expiringSoonPermits?.count),
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
