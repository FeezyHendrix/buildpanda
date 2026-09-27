import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { DrawingMarkup, DrawingMarkupComment } from "@/api/drawing-markup";
import { editorApi } from "@/api/precon-editor";
import { MarkupThreadPopover } from "@/components/molecules/markup-thread/markup-thread-popover";
import type { PopoverAnchor } from "@/components/molecules/markup-thread/pin-popover";
import { newOperationId } from "@/hooks/use-precon-editor";
import { useAddPreconMarkupComment, useResolvePreconMarkup } from "@/hooks/use-precon-markups";
import { preconMarkupKeys, preconKeys } from "@/hooks/query-keys";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { useSession } from "@/stores/auth";

/** An existing take-off pin's thread, written through the precon markup routes. */
export function PinThreadPopover({
  anchor,
  sessionId,
  markup,
  lineLabel,
  canEdit,
  onClose,
}: {
  anchor: PopoverAnchor;
  sessionId: string;
  markup: DrawingMarkup;
  lineLabel: string | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const addComment = useAddPreconMarkupComment(sessionId);
  const resolve = useResolvePreconMarkup(sessionId);
  const qc = useQueryClient();
  const { data: session } = useSession();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: preconMarkupKeys.session(sessionId) });
    void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
  };
  // Withdrawal is a versioned envelope operation: a receipt of its own, undoable,
  // and refused (409) if the pin moved under the reviewer (contract 12).
  const remove = useMutation({
    mutationFn: async (markupId: string) => {
      await editorApi.operate(sessionId, {
        operationId: newOperationId(),
        command: { kind: "delete-markup", markupId, version: markup.version ?? 1 },
      });
      return { ok: true as const };
    },
    onSuccess: invalidate,
  });
  const editComment = useMutation({
    mutationFn: ({ comment, body }: { comment: DrawingMarkupComment; body: string }) =>
      editorApi.operate(sessionId, {
        operationId: newOperationId(),
        command: { kind: "edit-comment", markupId: markup.id, commentId: comment.id, version: comment.version ?? 1, body },
      }),
    onSuccess: invalidate,
    onError: (error) => toast(getApiErrorMessage(error, "Only the author can edit a comment."), "error"),
  });
  return (
    <MarkupThreadPopover
      anchor={anchor}
      markup={markup}
      subtitle={lineLabel ? `On line: ${lineLabel}` : "Sheet note — not tied to a bill line"}
      canEdit={canEdit}
      actions={{ addComment, resolve, remove }}
      currentUserId={session?.user.id ?? null}
      onEditComment={(comment, body) => editComment.mutate({ comment, body })}
      onClose={onClose}
    />
  );
}
PinThreadPopover.displayName = "PinThreadPopover";
