import type { Currency } from "../projects/types.ts";
import type { AiSuggestion } from "../panda-ai/types.ts";

export interface BudgetReportingSlice {
  totalPlanned: number;
  totalCommitted: number;
  totalActual: number;
  totalVariance: number;
  totalRemaining: number;
  categoryCount: number;
  overBudgetCount: number;
  categories: BudgetCategoryPoint[];
}

export interface BudgetCategoryPoint {
  id: string;
  name: string;
  costCode: string | null;
  planned: number;
  committed: number;
  actual: number;
  variance: number;
}

export type PeriodYYYYMM = string;

export interface CashFlowPoint {
  period: PeriodYYYYMM;
  planned: number;
  actual: number;
  cumulativePlanned: number;
  cumulativeActual: number;
}

export interface CashFlowSlice {
  points: CashFlowPoint[];
}

export interface InvoiceAgingBuckets {
  current: number;
  thirtyToSixty: number;
  sixtyToNinety: number;
  overNinety: number;
}

export interface InvoiceReportingSlice {
  count: number;
  invoicedTotal: number;
  paidTotal: number;
  outstanding: number;
  retentionHeld: number;
  overdueCount: number;
  aging: InvoiceAgingBuckets;
}

export interface MilestoneSlice {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  lockedInEscrow: number;
}

export interface ChangeRequestSlice {
  approvedCostImpact: number;
  pendingCostImpact: number;
}

export interface FinanceReportingSlice {
  budget: BudgetReportingSlice;
  cashFlow: CashFlowSlice;
  invoices: InvoiceReportingSlice;
  milestones: MilestoneSlice;
  changeRequests: ChangeRequestSlice;
}

export interface PhaseRef {
  id: string;
  name: string;
  progressPercent: number;
}

export interface ScheduleReportingSlice {
  progressPercent: number;
  phasesInProgress: PhaseRef[];
  phasesUpcoming: PhaseRef[];
  programmeCostCurve: CashFlowPoint[] | null;
}

export interface OperationsReportingSlice {
  dueActionItems: number;
  blockedActionItems: number;
  openQueries: number;
  pendingApprovals: number;
  expiringPermits: number;
  overdueActivities: number;
  upcomingKeyDates: number;
  missedKeyDates: number;
}

export interface HealthPoint {
  at: string;
  score: number;
}

export interface HealthReportingSlice {
  score: number | null;
  suggestions: AiSuggestion[];
  lastAnalyzedAt: string | null;
  trendOldestFirst: HealthPoint[];
}

export interface RiskReportingSlice {
  open: number;
  high: number;
}

export interface InspectionReportingSlice {
  total: number;
  failed: number;
  pending: number;
}

export interface ActivityReportingSlice {
  recentUpdateCount: number;
  daysSinceLastUpdate: number | null;
  recentDailyLogCount: number;
  phaseCount: number;
  pendingPhaseCount: number;
}

export interface ProjectReportingSnapshot {
  projectId: string;
  generatedAt: string;
  currency: Currency;
  projectName: string;
  status: string;
  finance: FinanceReportingSlice;
  schedule: ScheduleReportingSlice;
  operations: OperationsReportingSlice;
  health: HealthReportingSlice;
  risks: RiskReportingSlice;
  inspections: InspectionReportingSlice;
  activity: ActivityReportingSlice;
}
