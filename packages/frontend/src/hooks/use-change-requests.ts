import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { changeRequestKeys } from "./query-keys";
import type {
  ChangeComment,
  ChangeRequest,
  ChangeRequestDetail,
  ChangeStatus,
} from "@/lib/project-types";

export function useChangeRequests(projectId: string | undefined, status?: ChangeStatus) {
  return useQuery({
    queryKey: changeRequestKeys.list(projectId ?? "__none__", status),
    queryFn: async () => {
      const { data } = await api.get<ChangeRequest[]>(`/projects/${projectId!}/change-requests`, {
        params: status ? { status } : undefined,
      });
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useChangeRequest(projectId: string | undefined, changeId: string | undefined) {
  return useQuery({
    queryKey: changeRequestKeys.detail(projectId ?? "__none__", changeId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<ChangeRequestDetail>(
        `/projects/${projectId!}/change-requests/${changeId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && changeId),
  });
}

export interface ChangeRequestInput {
  title: string;
  description?: string | null;
  reason?: string | null;
  status?: ChangeStatus;
  costImpact?: number;
  timeImpactDays?: number;
  currency?: "NGN" | "USD";
}

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: ChangeRequestInput & { projectId: string }) => {
      const { data } = await api.post<ChangeRequest>(`/projects/${projectId}/change-requests`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

export function useUpdateChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      changeId,
      ...body
    }: Partial<ChangeRequestInput> & { projectId: string; changeId: string }) => {
      const { data } = await api.patch<ChangeRequest>(
        `/projects/${projectId}/change-requests/${changeId}`,
        body,
      );
      return data;
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

export function useDeleteChangeRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, changeId }: { projectId: string; changeId: string }) => {
      await api.delete(`/projects/${projectId}/change-requests/${changeId}`);
    },
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) }),
  });
}

export function useAddChangeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      changeId,
      body,
    }: {
      projectId: string;
      changeId: string;
      body: string;
    }) => {
      const { data } = await api.post<ChangeComment>(
        `/projects/${projectId}/change-requests/${changeId}/comments`,
        { body },
      );
      return data;
    },
    onSuccess: (_d, { projectId, changeId }) => {
      qc.invalidateQueries({ queryKey: changeRequestKeys.detail(projectId, changeId) });
      qc.invalidateQueries({ queryKey: changeRequestKeys.all(projectId) });
    },
  });
}
