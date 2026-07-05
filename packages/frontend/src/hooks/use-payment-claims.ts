import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentClaimsApi, type PaymentClaimInput } from "@/api/payment-claims";

export type {
  PaymentClaimStatus,
  PaymentClaim,
  PaymentClaimInput,
} from "@/api/payment-claims";
import { paymentClaimKeys } from "./query-keys";

export function usePaymentClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? paymentClaimKeys.list(projectId)
      : paymentClaimKeys.list("__none__"),
    queryFn: () => paymentClaimsApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

interface CreatePaymentClaimVariables extends PaymentClaimInput {
  projectId: string;
}

export function useCreatePaymentClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreatePaymentClaimVariables) => paymentClaimsApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: paymentClaimKeys.list(projectId) });
    },
  });
}

interface UpdatePaymentClaimVariables extends PaymentClaimInput {
  projectId: string;
  claimId: string;
}

export function useUpdatePaymentClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, claimId, ...patch }: UpdatePaymentClaimVariables) => paymentClaimsApi.update(projectId, claimId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: paymentClaimKeys.list(projectId) });
    },
  });
}

interface DeletePaymentClaimVariables {
  projectId: string;
  claimId: string;
}

export function useDeletePaymentClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, claimId }: DeletePaymentClaimVariables) => paymentClaimsApi.delete(projectId, claimId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: paymentClaimKeys.list(projectId) });
    },
  });
}
