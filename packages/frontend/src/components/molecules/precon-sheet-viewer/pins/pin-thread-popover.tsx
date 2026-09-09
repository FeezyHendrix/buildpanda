import { useState } from "react";
import { Check, Mic, RotateCcw, Trash2, Video } from "lucide-react";
import { Button } from "@/components/atoms/button";
import type { DrawingMarkup, DrawingMarkupComment } from "@/api/drawing-markup";
import { useAddPreconMarkupComment, useDeletePreconMarkup, useResolvePreconMarkup } from "@/hooks/use-precon-markups";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatTimeAgo } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { PinPopover, TEXTAREA_CLASS, type PopoverAnchor } from "./pin-popover";

const MEDIA_LABEL = { audio: { label: "Audio note", Icon: Mic }, video: { label: "Video note", Icon: Video } } as const;

function CommentItem({ comment }: { comment: DrawingMarkupComment }) {
  const media = comment.mediaKind ? MEDIA_LABEL[comment.mediaKind] : null;
  return (
    <li className="rounded-lg bg-[#F6F6F6] px-2.5 py-2">
      <p className="flex items-baseline gap-2 text-[11px] text-gray-500">
        <span className="font-medium text-gray-800">{comment.authorName ?? "Someone"}</span>
        <span>{formatTimeAgo(comment.createdAt)}</span>
      </p>
      {media ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-gray-500">
          <media.Icon size={11} /> {media.label}
        </p>
      ) : null}
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{comment.body}</p>
    </li>
  );
}
CommentItem.displayName = "CommentItem";

/** An existing pin's thread: comments, a text reply, resolve/reopen and delete. */
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
  const [reply, setReply] = useState("");
  const addComment = useAddPreconMarkupComment(sessionId);
  const resolve = useResolvePreconMarkup(sessionId);
  const remove = useDeletePreconMarkup(sessionId);
  const resolved = markup.resolvedAt !== null;
  const onError = (e: unknown) => toast(getApiErrorMessage(e, "Could not update the comment."), "error");

  function sendReply(): void {
    const body = reply.trim();
    if (!body) return;
    addComment.mutate({ markupId: markup.id, body }, { onSuccess: () => setReply(""), onError });
  }

  return (
    <PinPopover anchor={anchor} title={resolved ? "Resolved comment" : "Comment"} color={markup.color} onClose={onClose}>
      <p className="mt-1.5 truncate text-[11px] text-gray-500">
        {lineLabel ? `On line: ${lineLabel}` : "Sheet note — not tied to a bill line"}
        {markup.authorName ? ` · raised by ${markup.authorName}` : ""}
      </p>
      <ul className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {markup.comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </ul>
      {canEdit ? (
        <>
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply();
            }}
            placeholder="Reply…"
            className={`mt-2 ${TEXTAREA_CLASS}`}
          />
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete comment"
              title="Delete comment"
              loading={remove.isPending}
              onClick={() => remove.mutate(markup.id, { onSuccess: onClose, onError })}
            >
              <Trash2 size={14} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              loading={resolve.isPending}
              onClick={() => resolve.mutate({ markupId: markup.id, resolved: !resolved }, { onError })}
            >
              {resolved ? <RotateCcw size={13} /> : <Check size={13} />}
              <span className="ml-1">{resolved ? "Reopen" : "Resolve"}</span>
            </Button>
            <Button size="sm" loading={addComment.isPending} disabled={!reply.trim()} onClick={sendReply}>
              Reply
            </Button>
          </div>
        </>
      ) : null}
    </PinPopover>
  );
}
PinThreadPopover.displayName = "PinThreadPopover";
