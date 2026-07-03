import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { updateKeys } from "./query-keys";
import type {
  MediaType,
  ProjectUpdate,
  UpdateCategory,
  UpdateComment,
  UpdateStatus,
} from "@/lib/project-types";

interface UpdateMediaInput {
  type: MediaType;
  url: string;
}

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

interface CreateUpdateVariables {
  projectId: string;
  category: UpdateCategory;
  title: string;
  description: string;
  media: UpdateMediaInput[];
}

export function useCreateUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      category,
      title,
      description,
      media,
    }: CreateUpdateVariables) => {
      const { data } = await api.post<ProjectUpdate>(
        `/projects/${projectId}/updates`,
        { category, title, description, media },
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

interface EditUpdateVariables {
  projectId: string;
  updateId: string;
  category?: UpdateCategory;
  title?: string;
  description?: string;
  media?: UpdateMediaInput[];
}

export function useEditUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      updateId,
      ...patch
    }: EditUpdateVariables) => {
      const { data } = await api.put<ProjectUpdate>(
        `/projects/${projectId}/updates/${updateId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

export function useGenerateAiDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const { data } = await api.post<ProjectUpdate>(
        `/projects/${projectId}/updates/ai-draft`,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

interface PublishUpdateVariables {
  projectId: string;
  updateId: string;
}

export function usePublishUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updateId }: PublishUpdateVariables) => {
      const { data } = await api.post<ProjectUpdate>(
        `/projects/${projectId}/updates/${updateId}/publish`,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

interface DeleteUpdateVariables {
  projectId: string;
  updateId: string;
}

export function useDeleteUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, updateId }: DeleteUpdateVariables) => {
      await api.delete(`/projects/${projectId}/updates/${updateId}`);
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}
