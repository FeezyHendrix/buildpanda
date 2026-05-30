import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { riskKeys } from "./query-keys";
import type { RiskFactor } from "@/lib/project-mock-data";

export function useProjectRiskFactors(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? riskKeys.all(projectId) : riskKeys.all("__none__"),
    queryFn: async () => {
      const { data } = await api.get<RiskFactor[]>(
        `/projects/${projectId!}/risk-factors`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}
