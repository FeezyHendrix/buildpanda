import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";

export interface FeatureFlag {
  key: string;
  label: string;
  group: string;
  description: string;
  enabledByDefault: boolean;
  routePrefixes: string[];
  enabled: boolean;
}

interface FeatureFlagsSettings {
  flags: FeatureFlag[];
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => api.get<FeatureFlagsSettings>("/feature-flags").then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useFeatureFlag(key: string): boolean {
  const { data } = useFeatureFlags();
  return useMemo(() => data?.flags.find((flag) => flag.key === key)?.enabled ?? true, [data, key]);
}
