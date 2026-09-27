import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  preconMarkupApi,
  type CreateMarkupCommentInput,
  type CreatePreconMarkupInput,
  type DrawingMarkup,
} from "@/api/drawing-markup";
import { preconMarkupKeys } from "@/hooks/query-keys";

const NO_MARKUPS: DrawingMarkup[] = [];

/** Every markup on a take-off session, all sheets; components filter by sheet. */
export function usePreconMarkups(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: preconMarkupKeys.session(sessionId ?? "__none__"),
    queryFn: () => preconMarkupApi.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

function useInvalidateSession(sessionId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: preconMarkupKeys.session(sessionId) });
}

export function useCreatePreconMarkup(sessionId: string) {
  const invalidate = useInvalidateSession(sessionId);
  return useMutation({
    mutationFn: (input: CreatePreconMarkupInput) => preconMarkupApi.create(sessionId, input),
    onSuccess: invalidate,
  });
}

export function useAddPreconMarkupComment(sessionId: string) {
  const invalidate = useInvalidateSession(sessionId);
  return useMutation({
    mutationFn: ({ markupId, ...body }: CreateMarkupCommentInput & { markupId: string }) =>
      preconMarkupApi.addComment(markupId, body),
    onSuccess: invalidate,
  });
}

export function useResolvePreconMarkup(sessionId: string) {
  const invalidate = useInvalidateSession(sessionId);
  return useMutation({
    mutationFn: ({ markupId, resolved }: { markupId: string; resolved: boolean }) =>
      preconMarkupApi.setResolved(markupId, resolved),
    onSuccess: invalidate,
  });
}

export function useDeletePreconMarkup(sessionId: string) {
  const invalidate = useInvalidateSession(sessionId);
  return useMutation({
    mutationFn: (markupId: string) => preconMarkupApi.remove(markupId),
    onSuccess: invalidate,
  });
}

/**
 * Open (unresolved) pins per bill row: rowId → count. Derived from the same
 * session query the pin layer uses, so the bill panel adds no request.
 */
export function useOpenCommentCounts(sessionId: string | null | undefined): ReadonlyMap<string, number> {
  const { data: markups = NO_MARKUPS } = usePreconMarkups(sessionId);
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of markups) {
      if (m.resolvedAt !== null || m.preconRowId === null) continue;
      counts.set(m.preconRowId, (counts.get(m.preconRowId) ?? 0) + 1);
    }
    return counts;
  }, [markups]);
}
