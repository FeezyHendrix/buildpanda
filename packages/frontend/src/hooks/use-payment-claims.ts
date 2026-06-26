import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { paymentClaimKeys } from "./query-keys";

export type PaymentClaimStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";

export interface PaymentClaim {
  id: string;
  projectId: string;
  milestonePaymentId: string | null;
  claimNumber: string;
  periodStart: string | null;
  periodEnd: string | null;
  amount: number;
  status: PaymentClaimStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PaymentClaimInput {
  milestonePaymentId?: string | null;
  claimNumber: string;
  periodStart?: string;
  periodEnd?: string;
  amount: number;
  status: PaymentClaimStatus;
  submittedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export function usePaymentClaims(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? paymentClaimKeys.list(projectId)
      : paymentClaimKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<PaymentClaim[]>(
        `/projects/${projectId!}/payment-claims`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreatePaymentClaimVariables extends PaymentClaimInput {
  projectId: string;
}

export function useCreatePaymentClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreatePaymentClaimVariables) => {
      const { data } = await api.post<PaymentClaim>(
        `/projects/${projectId}/payment-claims`,
        body,
      );
      return data;
    },
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
    mutationFn: async ({ projectId, claimId, ...patch }: UpdatePaymentClaimVariables) => {
      const { data } = await api.put<PaymentClaim>(
        `/projects/${projectId}/payment-claims/${claimId}`,
        patch,
      );
      return data;
    },
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
    mutationFn: async ({ projectId, claimId }: DeletePaymentClaimVariables) => {
      await api.delete(`/projects/${projectId}/payment-claims/${claimId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: paymentClaimKeys.list(projectId) });
    },
  });
}
