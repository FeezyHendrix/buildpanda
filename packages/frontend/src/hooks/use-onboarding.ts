import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import {
  onboardingApi,
  type CompleteOnboardingInput,
} from "@/api/onboarding";
import { onboardingKeys, organizationKeys } from "./query-keys";
import { useActiveOrganizationId } from "./use-organization";

export function useOnboardingStatus() {
  const orgId = useActiveOrganizationId();
  return useQuery({
    queryKey: onboardingKeys.status(orgId),
    queryFn: () => onboardingApi.status(),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    // 401 — the axios interceptor is already redirecting to sign-in.
    // 403 — no org scope, or the role cannot submit; a retry fixes neither.
    retry: (count, error) => {
      const status = (error as AxiosError).response?.status;
      return status === 401 || status === 403 ? false : count < 2;
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  const orgId = useActiveOrganizationId();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) => onboardingApi.complete(input),
    onSuccess: (status) => {
      // Seed the authoritative response instead of only invalidating: an
      // invalidate leaves a window where the destination guard still reads
      // completed:false and bounces the user straight back into the wizard.
      qc.setQueryData(onboardingKeys.status(orgId), status);
      qc.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}
