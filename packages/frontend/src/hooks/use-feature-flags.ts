import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { featureFlagsApi } from "@/api/feature-flags";
import type { FeatureFlag, FeatureFlagsSettings } from "@/api/feature-flags";
import type { FeatureFlagKey } from "@/lib/feature-flags";

export type { FeatureFlag, FeatureFlagsSettings };

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => featureFlagsApi.get(),
    staleTime: 5_000,
  });
}

/** Fail-open while loading: an unknown/loading flag reads as enabled. */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { data } = useFeatureFlags();
  return useMemo(() => data?.flags.find((flag) => flag.key === key)?.enabled ?? true, [data, key]);
}

/** Same value as useFeatureFlag, plus loading state so callers can fail-closed. */
export function useFeatureFlagState(key: FeatureFlagKey): { enabled: boolean; isLoading: boolean } {
  const { data, isPending } = useFeatureFlags();
  const enabled = useMemo(
    () => data?.flags.find((flag) => flag.key === key)?.enabled ?? true,
    [data, key],
  );
  return { enabled, isLoading: isPending };
}
