import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { materialApprovalKeys } from "./query-keys";
import {
  materialApprovalsApi,
  type MaterialApprovalCreateInput,
  type MaterialApprovalUpdateInput,
} from "@/api/material-approvals";
import type { ApprovalStatus } from "@/lib/project-types";

export function useMaterialApprovals(projectId: string | undefined, status?: ApprovalStatus) {
  return useQuery({
    queryKey: materialApprovalKeys.list(projectId ?? "__none__", status),
    queryFn: () => materialApprovalsApi.list(projectId!, status ? { status } : undefined),
    enabled: Boolean(projectId),
  });
}

export function useMaterialApproval(
  projectId: string | undefined,
  approvalId: string | undefined,
) {
  return useQuery({
    queryKey: materialApprovalKeys.detail(projectId ?? "__none__", approvalId ?? "__none__"),
    queryFn: () => materialApprovalsApi.detail(projectId!, approvalId!),
    enabled: Boolean(projectId && approvalId),
  });
}

export function useCreateMaterialApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      ...body
    }: MaterialApprovalCreateInput & { projectId: string }) =>
      materialApprovalsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: materialApprovalKeys.all(projectId) }),
  });
}

export function useUpdateMaterialApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      approvalId,
      ...body
    }: MaterialApprovalUpdateInput & { projectId: string; approvalId: string }) =>
      materialApprovalsApi.update(projectId, approvalId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: materialApprovalKeys.all(projectId) }),
  });
}

export function useDeleteMaterialApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, approvalId }: { projectId: string; approvalId: string }) =>
      materialApprovalsApi.delete(projectId, approvalId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: materialApprovalKeys.all(projectId) }),
  });
}

export function useAddMaterialApprovalComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      approvalId,
      body,
    }: {
      projectId: string;
      approvalId: string;
      body: string;
    }) => materialApprovalsApi.addComment(projectId, approvalId, body),
    onSuccess: (_d, { projectId, approvalId }) => {
      qc.invalidateQueries({ queryKey: materialApprovalKeys.detail(projectId, approvalId) });
      qc.invalidateQueries({ queryKey: materialApprovalKeys.all(projectId) });
    },
  });
}
