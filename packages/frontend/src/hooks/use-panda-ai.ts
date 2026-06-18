import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pandaAiKeys } from "./query-keys";

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

interface InsightResponse {
  insight: Insight | null;
}

const ACTIVE_STATUSES: InsightStatus[] = ["pending", "processing"];

export function useLatestInsight(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? pandaAiKeys.latest(projectId)
      : pandaAiKeys.latest("__none__"),
    queryFn: async () => {
      const { data } = await api.get<InsightResponse>(
        `/projects/${projectId!}/ai/insights`,
      );
      return data.insight;
    },
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const insight = query.state.data;
      if (insight && ACTIVE_STATUSES.includes(insight.status)) {
        return 2500;
      }
      return false;
    },
  });
}

export function useAnalyzeProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { data } = await api.post<InsightResponse>(
        `/projects/${projectId}/ai/analyze`,
      );
      return data.insight;
    },
    onSuccess: (insight, projectId) => {
      if (insight) {
        queryClient.setQueryData(pandaAiKeys.latest(projectId), insight);
      }
      queryClient.invalidateQueries({ queryKey: pandaAiKeys.latest(projectId) });
    },
  });
}

export interface DetectedPhase {
  name: string;
  durationWeeks: number;
}

export interface PhaseDetectionResult {
  phases: DetectedPhase[];
  usedAi: boolean;
}

export function useDetectPhases(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: pandaAiKeys.detectedPhases(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.post<PhaseDetectionResult>(
        `/projects/${projectId!}/ai/detect-phases`,
      );
      return data;
    },
    enabled: Boolean(projectId) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
