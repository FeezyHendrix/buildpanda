import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keyDateKeys } from "./query-keys";
import type { KeyDate, KeyDateStatus } from "@/lib/project-mock-data";

export function useKeyDates(projectId: string | undefined) {
  return useQuery({
    queryKey: keyDateKeys.list(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<KeyDate[]>(`/projects/${projectId!}/key-dates`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export interface KeyDateInput {
  label: string;
  targetDate?: string | null;
  actualDate?: string | null;
  status?: KeyDateStatus;
  notes?: string | null;
}

export function useCreateKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: KeyDateInput & { projectId: string }) => {
      const { data } = await api.post<KeyDate>(`/projects/${projectId}/key-dates`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}

export function useUpdateKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      keyDateId,
      ...body
    }: Partial<KeyDateInput> & { projectId: string; keyDateId: string }) => {
      const { data } = await api.patch<KeyDate>(`/projects/${projectId}/key-dates/${keyDateId}`, body);
      return data;
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}

export function useDeleteKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, keyDateId }: { projectId: string; keyDateId: string }) => {
      await api.delete(`/projects/${projectId}/key-dates/${keyDateId}`);
    },
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: keyDateKeys.all(projectId) }),
  });
}
