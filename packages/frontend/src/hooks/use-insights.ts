import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { insightKeys } from "./query-keys";
import type { ProjectInsights, WhatsNext } from "@/lib/project-mock-data";

export function useProjectInsights(projectId: string | undefined) {
  return useQuery({
    queryKey: insightKeys.insights(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectInsights>(`/projects/${projectId!}/insights`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useWhatsNext(projectId: string | undefined, days = 14) {
  return useQuery({
    queryKey: [...insightKeys.whatsNext(projectId ?? "__none__"), days],
    queryFn: async () => {
      const { data } = await api.get<WhatsNext>(`/projects/${projectId!}/whats-next`, {
        params: { days },
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}
