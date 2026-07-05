import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pandaAiApi } from "@/api/panda-ai";
import { pandaAiKeys } from "./query-keys";
import type {
  InsightStatus,
  SuggestionPriority,
  AiSuggestion,
  ProjectMetrics,
  Insight,
  DetectedPhase,
  PhaseDetectionResult,
} from "@/api/panda-ai";

export type {
  InsightStatus,
  SuggestionPriority,
  AiSuggestion,
  ProjectMetrics,
  Insight,
  DetectedPhase,
  PhaseDetectionResult,
};

const ACTIVE_STATUSES: InsightStatus[] = ["pending", "processing"];

export function useLatestInsight(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? pandaAiKeys.latest(projectId)
      : pandaAiKeys.latest("__none__"),
    queryFn: () => pandaAiApi.getLatestInsight(projectId!),
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
    mutationFn: (projectId: string) => pandaAiApi.analyzeProject(projectId),
    onSuccess: (insight, projectId) => {
      if (insight) {
        queryClient.setQueryData(pandaAiKeys.latest(projectId), insight);
      }
      queryClient.invalidateQueries({ queryKey: pandaAiKeys.latest(projectId) });
    },
  });
}

export function useDetectPhases(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: pandaAiKeys.detectedPhases(projectId ?? "__none__"),
    queryFn: () => pandaAiApi.detectPhases(projectId!),
    enabled: Boolean(projectId) && enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
