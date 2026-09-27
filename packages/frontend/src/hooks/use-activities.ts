import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { activityKeys, keyDateKeys, projectKeys, reportingKeys, stageKeys } from "./query-keys";
import { participantKeys } from "./use-participants";
import { activitiesApi, type CreateActivityInput, type UpdateActivityInput, type DeleteActivityInput, type RaiseDelayInput, type ResolveDelayInput } from "@/api/activities";

/**
 * Logging or amending a delay shifts the activity, every successor and the
 * non-contractual key dates hanging off them — so the whole programme is stale,
 * not just the row that was touched.
 */
function invalidateAfterCascade(
  queryClient: QueryClient,
  projectId: string,
  activityId: string,
): void {
  queryClient.invalidateQueries({ queryKey: activityKeys.delays(projectId, activityId) });
  queryClient.invalidateQueries({ queryKey: activityKeys.events(projectId, activityId) });
  queryClient.invalidateQueries({ queryKey: activityKeys.all(projectId) });
  queryClient.invalidateQueries({ queryKey: keyDateKeys.all(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
  // The Overview's completion position counts delayed activities and the
  // timeline shift, both of which have just changed.
  queryClient.invalidateQueries({ queryKey: reportingKeys.all(projectId) });
}

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

/** The delay register for one activity — reason, days lost, culpability, EOT, links. */
export function useActivityDelays(
  projectId: string | undefined,
  activityId: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && activityId
        ? activityKeys.delays(projectId, activityId)
        : activityKeys.delays("__none__", "__none__"),
    queryFn: () => activitiesApi.listDelays(projectId!, activityId!),
    enabled: Boolean(projectId && activityId),
  });
}

/** The programme audit trail: who moved this activity, by how many days and why. */
export function useActivityEvents(
  projectId: string | undefined,
  activityId: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && activityId
        ? activityKeys.events(projectId, activityId)
        : activityKeys.events("__none__", "__none__"),
    queryFn: () => activitiesApi.listEvents(projectId!, activityId!),
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
      invalidateAfterCascade(queryClient, projectId, activityId);
    },
  });
}

export function useResolveDelay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, activityId, delayId, ...body }: ResolveDelayInput) => activitiesApi.resolveDelay(projectId, activityId, delayId, body),
    onSuccess: (_data, { projectId, activityId }) => {
      invalidateAfterCascade(queryClient, projectId, activityId);
    },
  });
}
