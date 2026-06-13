import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { permitKeys } from "./query-keys";
import type { Permit, PermitStatus } from "@/lib/project-types";

export function usePermits(projectId: string | undefined) {
  return useQuery({
    queryKey: permitKeys.list(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<Permit[]>(`/projects/${projectId!}/permits`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export interface PermitInput {
  title: string;
  authority?: string | null;
  referenceNo?: string | null;
  status?: PermitStatus;
  appliedDate?: string | null;
  approvedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export function useCreatePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: PermitInput & { projectId: string }) => {
      const { data } = await api.post<Permit>(`/projects/${projectId}/permits`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}

export function useUpdatePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      permitId,
      ...body
    }: Partial<PermitInput> & { projectId: string; permitId: string }) => {
      const { data } = await api.patch<Permit>(`/projects/${projectId}/permits/${permitId}`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}

export function useDeletePermit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, permitId }: { projectId: string; permitId: string }) => {
      await api.delete(`/projects/${projectId}/permits/${permitId}`);
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: permitKeys.all(projectId) }),
  });
}
