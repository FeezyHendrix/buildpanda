import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stagesApi,
  type ScheduleOfValueLineInput,
  type StageInput,
  type StageScheduleOfValue,
} from "@/api/stages";
import { stageKeys } from "./query-keys";

export type { StageInput, ScheduleOfValueLineInput, StageScheduleOfValue };

export function useStages(projectId: string | undefined, buildingId?: string) {
  return useQuery({
    queryKey: stageKeys.list(projectId ?? "__none__", buildingId),
    queryFn: () => stagesApi.list(projectId!, buildingId),
    enabled: Boolean(projectId),
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }: StageInput & { projectId: string }) =>
      stagesApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      stageId,
      ...body
    }: Partial<StageInput> & { projectId: string; stageId: string }) =>
      stagesApi.update(projectId, stageId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, stageId }: { projectId: string; stageId: string }) =>
      stagesApi.remove(projectId, stageId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, stageIds }: { projectId: string; stageIds: string[] }) =>
      stagesApi.reorder(projectId, stageIds),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}

export function useScheduleOfValues(
  projectId: string | undefined,
  stageId: string | undefined,
) {
  return useQuery({
    queryKey: stageKeys.scheduleOfValues(projectId ?? "__none__", stageId),
    queryFn: () => stagesApi.scheduleOfValues(projectId!, stageId!),
    enabled: Boolean(projectId && stageId),
  });
}

export function useReplaceScheduleOfValues() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      stageId,
      lines,
    }: {
      projectId: string;
      stageId: string;
      lines: ScheduleOfValueLineInput[];
    }) => stagesApi.replaceScheduleOfValues(projectId, stageId, lines),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
    },
  });
}
