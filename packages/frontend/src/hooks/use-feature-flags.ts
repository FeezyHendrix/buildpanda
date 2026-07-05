import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { featureFlagsApi } from "@/api/feature-flags";
import type { FeatureFlag, FeatureFlagsSettings } from "@/api/feature-flags";

export type { FeatureFlag, FeatureFlagsSettings };

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlagsApi.get(),
    staleTime: 60_000,
  });
}

export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags();
  return useMemo(() => data?.flags.find((flag) => flag.key === key)?.enabled ?? true, [data, key]);
}
