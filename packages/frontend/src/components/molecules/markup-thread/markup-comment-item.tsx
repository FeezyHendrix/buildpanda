import { useState } from "react";
import { Mic, Pencil, UserRound, Video } from "lucide-react";
import { MEDIA_KIND, type DrawingMarkupComment, type MediaKind } from "@/api/drawing-markup";
import { Spinner } from "@/components/atoms/spinner";
import { MediaNotePlayer } from "@/components/molecules/comment-pin";
import { useFileUrl } from "@/hooks/use-files";
import { formatTimeAgo } from "@/lib/formatters";

const MEDIA_META: Record<MediaKind, { label: string; Icon: typeof Mic }> = {
  [MEDIA_KIND.AUDIO]: { label: "Voice note", Icon: Mic },
  [MEDIA_KIND.VIDEO]: { label: "Video note", Icon: Video },
};

function formatDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A voice or video note: the label line, then the player once the signed file URL resolves. */
function MediaNote({ comment, mediaKind }: { comment: DrawingMarkupComment; mediaKind: MediaKind }) {
  const url = useFileUrl(comment.fileId);
  const { label, Icon } = MEDIA_META[mediaKind];
  return (
    <div className="mt-1">
      <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
        <Icon size={11} aria-hidden="true" /> {label}
        {comment.mediaDurationSeconds !== null ? (
          <span className="font-mono text-gray-400">· {formatDuration(comment.mediaDurationSeconds)}</span>
        ) : null}
      </p>
      {!comment.fileId ? (
        <p className="mt-1 text-xs text-amber-700">The recording has not finished uploading from the field.</p>
      ) : url.isPending ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <Spinner size="xs" /> Loading recording…
        </div>
      ) : url.isError || !url.data ? (
        <p className="mt-1 text-xs text-red-700">Could not load the recording.</p>
      ) : (
        <MediaNotePlayer url={url.data} mode={mediaKind} />
      )}
    </div>
  );
}
MediaNote.displayName = "MediaNote";

/**
 * One comment in a markup thread, as the field or the office posted it: who
 * and when, the text (rich or plain), the voice/video note, and who it was
 * handed to.
 */
export function MarkupCommentItem({
  comment,
  canEditOwn = false,
  onEdit,
}: {
  comment: DrawingMarkupComment;
  /** True when the viewer authored this comment and an edit path is wired. */
  canEditOwn?: boolean;
  onEdit?: (comment: DrawingMarkupComment, body: string) => void;
}) {
  const body = comment.body.trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  if (editing) {
    return (
      <li className="rounded-lg bg-surface-alt px-2.5 py-2" data-comment-editing>
        <textarea aria-label="Edit comment" rows={2} className="w-full rounded-md border border-line px-2 py-1 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="mt-1 flex justify-end gap-1.5 text-xs">
          <button type="button" className="underline" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="font-semibold text-primary-700"
            disabled={draft.trim() === ""}
            onClick={() => {
              onEdit?.(comment, draft.trim());
              setEditing(false);
            }}
          >
            Save edit
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="rounded-lg bg-surface-alt px-2.5 py-2">
      <p className="flex items-baseline gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-800">{comment.authorName ?? "Someone"}</span>
        <time dateTime={comment.createdAt}>{formatTimeAgo(comment.createdAt)}</time>
        {canEditOwn && onEdit ? (
          <button
            type="button"
            aria-label="Edit your comment"
            className="ml-auto text-gray-400 hover:text-gray-700"
            onClick={() => {
              setDraft(body);
              setEditing(true);
            }}
          >
            <Pencil size={11} aria-hidden="true" />
          </button>
        ) : null}
      </p>
      {comment.bodyHtml ? (
        <div
          className="prose prose-sm mt-0.5 max-w-none text-sm text-gray-900 [&_img]:max-h-48 [&_img]:rounded"
          dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
        />
      ) : body ? (
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{body}</p>
      ) : null}
      {comment.mediaKind ? <MediaNote comment={comment} mediaKind={comment.mediaKind} /> : null}
      {comment.assigneeName ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary-700">
          <UserRound size={11} aria-hidden="true" /> Assigned to {comment.assigneeName}
        </p>
      ) : null}
    </li>
  );
}
MarkupCommentItem.displayName = "MarkupCommentItem";
