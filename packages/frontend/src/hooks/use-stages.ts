import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { stageKeys } from "./query-keys";
import type { Stage, StageStatus } from "@/lib/project-types";

export function useStages(projectId: string | undefined) {
  return useQuery({
    queryKey: stageKeys.list(projectId ?? "__none__"),
    queryFn: async () => {
      const { data } = await api.get<Stage[]>(`/projects/${projectId!}/stages`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export interface StageInput {
  name: string;
  status?: StageStatus;
  startDate?: string | null;
  endDate?: string | null;
  progressPercent?: number;
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...body }: StageInput & { projectId: string }) => {
      const { data } = await api.post<Stage>(`/projects/${projectId}/stages`, body);
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      stageId,
      ...body
    }: Partial<StageInput> & { projectId: string; stageId: string }) => {
      const { data } = await api.patch<Stage>(
        `/projects/${projectId}/stages/${stageId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, stageId }: { projectId: string; stageId: string }) => {
      await api.delete(`/projects/${projectId}/stages/${stageId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, stageIds }: { projectId: string; stageIds: string[] }) => {
      const { data } = await api.patch<Stage[]>(`/projects/${projectId}/stages/reorder`, {
        stageIds,
      });
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}
