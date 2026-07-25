import type { ReactNode } from "react";
import { useFeatureFlagState } from "@/hooks/use-feature-flags";
import type { FeatureFlagKey } from "@/lib/feature-flags";

interface FeatureGateProps {
  flag: FeatureFlagKey;
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * Loading behavior before the flags query resolves.
   * - "fail-open" (default): render children — matches the app's `?? true`
   *   default and avoids flicker.
   * - "fail-closed": render fallback — for expensive or destructive surfaces.
   */
  mode?: "fail-open" | "fail-closed";
}

export function FeatureGate({ flag, children, fallback = null, mode = "fail-open" }: FeatureGateProps) {
  const { enabled, isLoading } = useFeatureFlagState(flag);
  if (isLoading && mode === "fail-closed") return <>{fallback}</>;
  return <>{enabled ? children : fallback}</>;
}
