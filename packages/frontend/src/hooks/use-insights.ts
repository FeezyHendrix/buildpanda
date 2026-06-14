import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { insightKeys } from "./query-keys";
import type { ProjectInsights, WhatsNext, GlobalWhatsNext } from "@/lib/project-types";

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

export function useGlobalWhatsNext(days = 14) {
  return useQuery({
    queryKey: ["whats-next", "global", days],
    queryFn: async () => {
      const { data } = await api.get<GlobalWhatsNext>("/whats-next", { params: { days } });
      return data;
    },
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
