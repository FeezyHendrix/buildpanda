import type { DrawingMarkup } from "@/api/drawing-markup";
import { MarkupThreadPopover } from "@/components/molecules/markup-thread/markup-thread-popover";
import type { PopoverAnchor } from "@/components/molecules/markup-thread/pin-popover";
import { useAddPreconMarkupComment, useDeletePreconMarkup, useResolvePreconMarkup } from "@/hooks/use-precon-markups";

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
  const remove = useDeletePreconMarkup(sessionId);
  return (
    <MarkupThreadPopover
      anchor={anchor}
      markup={markup}
      subtitle={lineLabel ? `On line: ${lineLabel}` : "Sheet note — not tied to a bill line"}
      canEdit={canEdit}
      actions={{ addComment, resolve, remove }}
      onClose={onClose}
    />
  );
}
PinThreadPopover.displayName = "PinThreadPopover";
