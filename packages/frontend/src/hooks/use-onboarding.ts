import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  onboardingApi,
  type CompleteOnboardingInput,
} from "@/api/onboarding";
import { onboardingKeys } from "./query-keys";

export function useOnboardingStatus() {
  return useQuery({
    queryKey: onboardingKeys.status(),
    queryFn: () => onboardingApi.status(),
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) => onboardingApi.complete(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: onboardingKeys.all });
    },
  });
}
