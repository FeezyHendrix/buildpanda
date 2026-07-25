import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activityKeys, projectKeys, stageKeys } from "./query-keys";
import { participantKeys } from "./use-participants";
import { activitiesApi, type CreateActivityInput, type UpdateActivityInput, type DeleteActivityInput, type RaiseDelayInput, type ResolveDelayInput } from "@/api/activities";

export function useProjectActivities(projectId: string | undefined, buildingId?: string) {
  return useQuery({
    queryKey: projectId
      ? activityKeys.list(projectId, buildingId)
      : activityKeys.list("__none__"),
    queryFn: () => activitiesApi.list(projectId!, buildingId),
    enabled: Boolean(projectId),
  });
}

export function useProjectActivity(
  projectId: string | undefined,
  activityId: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && activityId
        ? activityKeys.detail(projectId, activityId)
        : activityKeys.detail("__none__", "__none__"),
    queryFn: () => activitiesApi.detail(projectId!, activityId!),
    enabled: Boolean(projectId && activityId),
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateActivityInput) => activitiesApi.create(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: participantKeys.myProjects() });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, activityId, ...body }: UpdateActivityInput) => activitiesApi.update(projectId, activityId, body),
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: participantKeys.myProjects() });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, activityId }: DeleteActivityInput) => activitiesApi.delete(projectId, activityId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: participantKeys.myProjects() });
    },
  });
}

export function useRaiseDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, activityId, ...body }: RaiseDelayInput) => activitiesApi.raiseDelay(projectId, activityId, body),
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
    },
  });
}

export function useResolveDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, activityId, delayId, ...body }: ResolveDelayInput) => activitiesApi.resolveDelay(projectId, activityId, delayId, body),
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
    },
  });
}
