import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateKeys } from "./query-keys";
import {
  updatesApi,
  type UpdateMediaInput,
} from "@/api/updates";
import type {
  UpdateCategory,
  UpdateStatus,
} from "@/lib/project-types";

export type { UpdateMediaInput };

export function useProjectUpdates(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? updateKeys.list(projectId)
      : updateKeys.list("__none__"),
    queryFn: () => updatesApi.list(projectId!),
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
    queryFn: () => updatesApi.getComments(projectId!, updateId!),
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
    mutationFn: ({ projectId, updateId, status }: TransitionVariables) =>
      updatesApi.transition(projectId, updateId, status),
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
    mutationFn: ({ projectId, updateId, body }: AddCommentVariables) =>
      updatesApi.addComment(projectId, updateId, body),
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
    mutationFn: ({ projectId, ...body }: CreateUpdateVariables) =>
      updatesApi.create(projectId, body),
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
    mutationFn: ({ projectId, updateId, ...patch }: EditUpdateVariables) =>
      updatesApi.edit(projectId, updateId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}

export function useGenerateAiDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      updatesApi.generateAiDraft(projectId),
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
    mutationFn: ({ projectId, updateId }: PublishUpdateVariables) =>
      updatesApi.publish(projectId, updateId),
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
    mutationFn: ({ projectId, updateId }: DeleteUpdateVariables) =>
      updatesApi.delete(projectId, updateId),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.list(projectId) });
    },
  });
}
