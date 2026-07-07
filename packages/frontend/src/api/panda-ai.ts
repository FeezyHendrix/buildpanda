import api from "./client";

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

export interface InsightResponse {
  insight: Insight | null;
}

export interface DetectedPhase {
  name: string;
  durationWeeks: number;
}

export interface PhaseDetectionResult {
  phases: DetectedPhase[];
  usedAi: boolean;
}

export const pandaAiApi = {
  getLatestInsight: (projectId: string) =>
    api.get<InsightResponse>(`/projects/${projectId}/ai/insights`).then((r) => r.data.insight),
  analyzeProject: (projectId: string) =>
    api.post<InsightResponse>(`/projects/${projectId}/ai/analyze`).then((r) => r.data.insight),
  detectPhases: (projectId: string) =>
    api.post<PhaseDetectionResult>(`/projects/${projectId}/ai/detect-phases`).then((r) => r.data),
};
