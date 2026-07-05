import { useQuery } from "@tanstack/react-query";
import { delayReasonKeys } from "./query-keys";
import { delayReasonsApi } from "@/api/delay-reasons";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function useDelayReasons() {
  return useQuery({
    queryKey: delayReasonKeys.all,
    queryFn: () => delayReasonsApi.list(),
    staleTime: ONE_HOUR_MS,
  });
}
