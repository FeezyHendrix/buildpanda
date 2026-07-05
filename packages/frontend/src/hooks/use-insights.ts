import { useQuery } from "@tanstack/react-query";
import { insightKeys } from "./query-keys";
import { insightsApi } from "@/api/insights";

export function useProjectInsights(projectId: string | undefined) {
  return useQuery({
    queryKey: insightKeys.insights(projectId ?? "__none__"),
    queryFn: async () => {
      return insightsApi.getInsights(projectId!);
    },
    enabled: Boolean(projectId),
  });
}

export function useGlobalWhatsNext(days = 14) {
  return useQuery({
    queryKey: ["whats-next", "global", days],
    queryFn: async () => {
      return insightsApi.getGlobalWhatsNext(days);
    },
  });
}

export function useWhatsNext(projectId: string | undefined, days = 14) {
  return useQuery({
    queryKey: [...insightKeys.whatsNext(projectId ?? "__none__"), days],
    queryFn: async () => {
      return insightsApi.getWhatsNext(projectId!, days);
    },
    enabled: Boolean(projectId),
  });
}
