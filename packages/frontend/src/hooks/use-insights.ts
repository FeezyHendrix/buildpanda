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
