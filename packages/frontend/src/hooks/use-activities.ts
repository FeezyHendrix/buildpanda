import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { activityKeys } from "./query-keys";
import type {
  Activity,
  ActivityDelay,
  ActivityStatus,
  Currency,
} from "@/lib/project-types";

export function useProjectActivities(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? activityKeys.list(projectId)
      : activityKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<Activity[]>(
        `/projects/${projectId!}/activities`,
      );
      return data;
    },
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
    queryFn: async () => {
      const { data } = await api.get<Activity>(
        `/projects/${projectId!}/activities/${activityId!}`,
      );
      return data;
    },
    enabled: Boolean(projectId && activityId),
  });
}

export interface CreateActivityInput {
  projectId: string;
  name: string;
  activityType: string;
  phaseId?: string | null;
  location?: string;
  plannedStartAt: string;
  plannedEndAt: string;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string;
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreateActivityInput) => {
      const { data } = await api.post<Activity>(
        `/projects/${projectId}/activities`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(projectId) });
    },
  });
}

export interface UpdateActivityInput {
  projectId: string;
  activityId: string;
  name?: string;
  activityType?: string;
  phaseId?: string | null;
  location?: string | null;
  status?: ActivityStatus;
  plannedStartAt?: string;
  plannedEndAt?: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  workerCountPlanned?: number;
  assigneeId?: string | null;
  notes?: string | null;
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      activityId,
      ...body
    }: UpdateActivityInput) => {
      const { data } = await api.patch<Activity>(
        `/projects/${projectId}/activities/${activityId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
    },
  });
}

export interface DeleteActivityInput {
  projectId: string;
  activityId: string;
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, activityId }: DeleteActivityInput) => {
      await api.delete(`/projects/${projectId}/activities/${activityId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(projectId) });
    },
  });
}

export interface RaiseDelayInput {
  projectId: string;
  activityId: string;
  reasonCode: string;
  description?: string;
  startedAt: string;
  costImpact?: number;
  currency?: Currency;
  preventionNotes?: string;
}

export function useRaiseDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      activityId,
      ...body
    }: RaiseDelayInput) => {
      const { data } = await api.post<ActivityDelay>(
        `/projects/${projectId}/activities/${activityId}/delays`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
    },
  });
}

export interface ResolveDelayInput {
  projectId: string;
  activityId: string;
  delayId: string;
  resolvedAt: string;
  preventionNotes?: string;
}

export function useResolveDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      activityId,
      delayId,
      ...body
    }: ResolveDelayInput) => {
      const { data } = await api.patch<ActivityDelay>(
        `/projects/${projectId}/activities/${activityId}/delays/${delayId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId, activityId }) => {
      queryClient.invalidateQueries({
        queryKey: activityKeys.detail(projectId, activityId),
      });
      queryClient.invalidateQueries({ queryKey: activityKeys.list(projectId) });
    },
  });
}
