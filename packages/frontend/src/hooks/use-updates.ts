import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { updateKeys } from "./query-keys";
import type {
  ProjectUpdate,
  UpdateComment,
  UpdateStatus,
} from "@/lib/project-mock-data";

export function useProjectUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? updateKeys.list(projectId)
      : updateKeys.list("__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectUpdate[]>(
        `/projects/${projectId!}/updates`,
      );
      return data;
    },
    enabled: Boolean(projectId),
  });
}

export function useUpdateComments(
  projectId: string | undefined,
  updateId: string | undefined,
) {
  return useQuery({
    queryKey:
      projectId && updateId
        ? updateKeys.comments(projectId, updateId)
        : updateKeys.comments("__none__", "__none__"),
    queryFn: async () => {
      const { data } = await api.get<UpdateComment[]>(
        `/projects/${projectId!}/updates/${updateId!}/comments`,
      );
      return data;
    },
    enabled: Boolean(projectId && updateId),
  });
}

interface TransitionVariables {
  projectId: string;
  updateId: string;
  status: Exclude<UpdateStatus, "Open">;
}

export function useTransitionUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updateId, status }: TransitionVariables) => {
      const { data } = await api.patch<ProjectUpdate>(
        `/projects/${projectId}/updates/${updateId}`,
        { status },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

interface AddCommentVariables {
  projectId: string;
  updateId: string;
  body: string;
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updateId, body }: AddCommentVariables) => {
      const { data } = await api.post<UpdateComment>(
        `/projects/${projectId}/updates/${updateId}/comments`,
        { body },
      );
      return data;
    },
    onSuccess: (_data, { projectId, updateId }) => {
      queryClient.invalidateQueries({
        queryKey: updateKeys.comments(projectId, updateId),
      });
    },
  });
}
