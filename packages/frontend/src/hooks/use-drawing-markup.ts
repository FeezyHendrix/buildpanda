import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  drawingMarkupApi,
  type CreateMarkupCommentInput,
  type CreateMarkupInput,
} from "@/api/drawing-markup";
import { drawingMarkupKeys } from "./query-keys";

export function useDrawingMarkups(
  projectId: string | undefined,
  documentVersionId: string | null | undefined,
  pageNo?: number,
) {
  return useQuery({
    queryKey: drawingMarkupKeys.version(
      projectId ?? "__none__",
      documentVersionId ?? "__none__",
      pageNo,
    ),
    queryFn: () => drawingMarkupApi.listForVersion(projectId!, documentVersionId!, pageNo),
    enabled: Boolean(projectId && documentVersionId),
  });
}

export function useCreateDrawingMarkup(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMarkupInput) => drawingMarkupApi.create(projectId!, input),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: drawingMarkupKeys.all(projectId) });
      }
    },
  });
}

export function useAddMarkupComment(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ markupId, ...body }: CreateMarkupCommentInput & { markupId: string }) =>
      drawingMarkupApi.addComment(projectId!, markupId, body),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: drawingMarkupKeys.all(projectId) });
      }
    },
  });
}

export function useDeleteDrawingMarkup(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (markupId: string) => drawingMarkupApi.remove(projectId!, markupId),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: drawingMarkupKeys.all(projectId) });
      }
    },
  });
}

export function useResolveDrawingMarkup(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ markupId, resolved }: { markupId: string; resolved: boolean }) =>
      drawingMarkupApi.setResolved(projectId!, markupId, resolved),
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: drawingMarkupKeys.all(projectId) });
      }
    },
  });
}
