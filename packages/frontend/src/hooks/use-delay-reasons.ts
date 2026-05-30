import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { delayReasonKeys } from "./query-keys";
import type { DelayReason } from "@/lib/project-mock-data";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useDelayReasons() {
  return useQuery({
    queryKey: delayReasonKeys.all,
    queryFn: async () => {
      const { data } = await api.get<DelayReason[]>("/delay-reasons");
      return data;
    },
    staleTime: ONE_HOUR_MS,
  });
}
