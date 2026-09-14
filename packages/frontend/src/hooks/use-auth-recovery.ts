import { useMutation, useQuery } from "@tanstack/react-query";
import { authRecoveryApi } from "@/api/auth-recovery";

const authRecoveryKeys = {
  verification: (token: string | null) => ["email-verification", token] as const,
};

export function useEmailVerification(token: string | null) {
  return useQuery({
    queryKey: authRecoveryKeys.verification(token),
    queryFn: () => authRecoveryApi.verify(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authRecoveryApi.resend });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: authRecoveryApi.requestReset });
}

export function useResetPassword() {
  return useMutation({ mutationFn: authRecoveryApi.resetPassword });
}
