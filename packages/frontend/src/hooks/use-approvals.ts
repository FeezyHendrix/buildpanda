import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { approvalKeys } from "./query-keys";
import type {
  Approval,
  ApprovalComment,
  ApprovalDetail,
  ApprovalStatus,
} from "@/lib/project-types";

export function useApprovals(projectId: string | undefined, status?: ApprovalStatus) {
  return useQuery({
    queryKey: approvalKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<Approval[]>(`/projects/${projectId!}/approvals`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useApproval(projectId: string | undefined, approvalId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.detail(projectId ?? "__none__", approvalId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ApprovalDetail>(
        `/projects/${projectId!}/approvals/${approvalId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && approvalId),
  });
}

export interface ApprovalCreateInput {
  title: string;
  category?: string | null;
  description?: string | null;
  dueDate?: string | null;
}

export interface ApprovalUpdateInput {
  title?: string;
  category?: string | null;
  description?: string | null;
  status?: ApprovalStatus;
  response?: string | null;
  dueDate?: string | null;
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: ApprovalCreateInput & { projectId: string }) => {
      const { data } = await api.post<Approval>(`/projects/${projectId}/approvals`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useUpdateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      approvalId,
      ...body
    }: ApprovalUpdateInput & { projectId: string; approvalId: string }) => {
      const { data } = await api.patch<Approval>(
        `/projects/${projectId}/approvals/${approvalId}`,
        body,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useDeleteApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, approvalId }: { projectId: string; approvalId: string }) => {
      await api.delete(`/projects/${projectId}/approvals/${approvalId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) }),
  });
}

export function useAddApprovalComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      approvalId,
      body,
    }: {
      projectId: string;
      approvalId: string;
      body: string;
    }) => {
      const { data } = await api.post<ApprovalComment>(
        `/projects/${projectId}/approvals/${approvalId}/comments`,
        { body },
      );
      return data;
    },
    onSuccess: (_d, { projectId, approvalId }) => {
      qc.invalidateQueries({ queryKey: approvalKeys.detail(projectId, approvalId) });
      qc.invalidateQueries({ queryKey: approvalKeys.all(projectId) });
    },
  });
}
