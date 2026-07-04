import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { lookAheadKeys } from "./query-keys";
import type { LookAheadResult } from "@/lib/project-types";

export function useMaterialsLookAhead(projectId: string | undefined, weeks = 4) {
  return useQuery({
    queryKey: lookAheadKeys.detail(projectId ?? "__none__", weeks),
    queryFn: async () => {
      const { data } = await api.get<LookAheadResult>(
        `/projects/${projectId!}/materials/look-ahead`,
        { params: { weeks } },
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}
