import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { reportingKeys } from "./query-keys";
import type { AiSuggestion } from "./use-panda-ai";
import type { Currency } from "@/lib/project-types";

export interface BudgetCategoryPoint {
  id: string;
  name: string;
  costCode: string | null;
  planned: number;
  committed: number;
  actual: number;
  variance: number;
}

export interface CashFlowPoint {
  period: string;
  planned: number;
  actual: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

export interface InvoiceAgingBuckets {
  current: number;
  thirtyToSixty: number;
  sixtyToNinety: number;
  overNinety: number;
}

export interface HealthPoint {
  at: string;
  score: number;
}

export interface PhaseRef {
  id: string;
  name: string;
  progressPercent: number;
}

export interface ProjectReportingSnapshot {
  projectId: string;
  generatedAt: string;
  currency: Currency;
  projectName: string;
  status: string;
  finance: {
    budget: {
      totalPlanned: number;
      totalCommitted: number;
      totalActual: number;
      totalVariance: number;
      totalRemaining: number;
      categoryCount: number;
      overBudgetCount: number;
      categories: BudgetCategoryPoint[];
    };
    cashFlow: { points: CashFlowPoint[] };
    invoices: {
      count: number;
      invoicedTotal: number;
      paidTotal: number;
      outstanding: number;
      retentionHeld: number;
      overdueCount: number;
      aging: InvoiceAgingBuckets;
    };
    milestones: {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      lockedInEscrow: number;
    };
    changeRequests: {
      approvedCostImpact: number;
      pendingCostImpact: number;
    };
  };
  schedule: {
    progressPercent: number;
    phasesInProgress: PhaseRef[];
    phasesUpcoming: PhaseRef[];
    programmeCostCurve: CashFlowPoint[] | null;
  };
  operations: {
    dueActionItems: number;
    blockedActionItems: number;
    openQueries: number;
    pendingApprovals: number;
    expiringPermits: number;
    upcomingKeyDates: number;
  };
  health: {
    score: number | null;
    suggestions: AiSuggestion[];
    lastAnalyzedAt: string | null;
    trendOldestFirst: HealthPoint[];
  };
  risks: {
    open: number;
    high: number;
  };
  inspections: {
    total: number;
    failed: number;
    pending: number;
  };
  activity: {
    recentUpdateCount: number;
    daysSinceLastUpdate: number | null;
    recentDailyLogCount: number;
    phaseCount: number;
    pendingPhaseCount: number;
  };
}

export function useReportingSnapshot(projectId: string | undefined) {
  return useQuery({
    queryKey: reportingKeys.snapshot(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectReportingSnapshot>(
        `/projects/${projectId!}/reporting/snapshot`,
      );
      return data;
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
}
