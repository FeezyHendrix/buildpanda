import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvalKeys } from "./query-keys";
import { approvalsApi, type ApprovalCreateInput, type ApprovalUpdateInput } from "@/api/approvals";
import type { ApprovalStatus } from "@/lib/project-types";

export function useApprovals(projectId: string | undefined, status?: ApprovalStatus) {
  return useQuery({
    queryKey: approvalKeys.list(projectId ?? "__none__", status),
    queryFn: () => approvalsApi.list(projectId!, status ? { status } : undefined),
    enabled: Boolean(projectId),
  });
}

export function useApproval(projectId: string | undefined, approvalId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.detail(projectId ?? "__none__", approvalId ?? "__none__"),
    queryFn: () => approvalsApi.detail(projectId!, approvalId!),
    enabled: Boolean(projectId && approvalId),
  });
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: ApprovalCreateInput & { projectId: string }) => approvalsApi.create(projectId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useUpdateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, approvalId, ...body }: ApprovalUpdateInput & { projectId: string; approvalId: string }) => approvalsApi.update(projectId, approvalId, body),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useDeleteApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, approvalId }: { projectId: string; approvalId: string }) => approvalsApi.delete(projectId, approvalId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useAddApprovalComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, approvalId, body }: { projectId: string; approvalId: string; body: string }) => approvalsApi.addComment(projectId, approvalId, body),
    onSuccess: (_d, { projectId, approvalId }) => {
      qc.invalidateQueries({ queryKey: approvalKeys.detail(projectId, approvalId) });
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) });
    },
  });
}
