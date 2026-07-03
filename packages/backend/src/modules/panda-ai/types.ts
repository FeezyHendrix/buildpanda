export type InsightStatus = "pending" | "processing" | "complete" | "failed";

export type SuggestionPriority = "high" | "medium" | "low";

export interface AiSuggestion {
  title: string;
  detail: string;
  priority: SuggestionPriority;
  category: string;
}

export interface ProjectMetrics {
  projectName: string;
  status: string;
  currency: string;
  progressPercent: number;
  phaseCount: number;
  pendingPhaseCount: number;
  budgetPlanned: number;
  budgetCommitted: number;
  budgetActual: number;
  budgetVariance: number;
  overBudgetCategories: number;
  invoiceCount: number;
  invoicedTotal: number;
  paidTotal: number;
  outstandingInvoiced: number;
  overdueInvoiceCount: number;
  openRiskCount: number;
  highRiskCount: number;
  inspectionCount: number;
  failedInspectionCount: number;
  pendingInspectionCount: number;
  recentUpdateCount: number;
  daysSinceLastUpdate: number | null;
  recentDailyLogCount: number;
  missedKeyDateCount: number;
  overdueActivityCount: number;
  dueActionItemCount: number;
  blockedActionItemCount: number;
  openQueryCount: number;
  pendingApprovalCount: number;
  expiringPermitCount: number;
  pendingChangeRequestCostImpact: number;
}

export interface AiInsightResult {
  summary: string;
  suggestions: AiSuggestion[];
  healthScore: number;
  model: string;
}

export interface InsightRow {
  id: string;
  project_id: string;
  status: InsightStatus;
  summary: string | null;
  suggestions: AiSuggestion[] | string;
  metrics: ProjectMetrics | string | null;
  health_score: number | null;
  model: string | null;
  error: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Insight {
  id: string;
  projectId: string;
  status: InsightStatus;
  summary: string | null;
  suggestions: AiSuggestion[];
  metrics: ProjectMetrics | null;
  healthScore: number | null;
  model: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseJson<T>(value: T | string | null): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value;
}

export function toInsight(row: InsightRow): Insight {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    summary: row.summary,
    suggestions: parseJson<AiSuggestion[]>(row.suggestions) ?? [],
    metrics: parseJson<ProjectMetrics>(row.metrics),
    healthScore: row.health_score,
    model: row.model,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
