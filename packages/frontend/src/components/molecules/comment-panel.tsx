import { RichContent } from "@/components/molecules/rich-content";
import { CommentAudio } from "./comment-audio";
import { ImageTextarea } from "@/components/molecules/image-textarea";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { INPUT_BASE_CLASS } from "@/components/atoms/input";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { UpdateComment } from "@/lib/project-types";

interface CommentPanelProps {
  projectId: string;
  canComment: boolean;
  comments: UpdateComment[];
  isLoading?: boolean;
  isSubmitting?: boolean;
  onSubmit: (body: string) => Promise<void>;
  className?: string;
}

function CommentPanel({
  projectId,
  canComment,
  comments,
  isLoading = false,
  isSubmitting = false,
  onSubmit,
  className,
}: CommentPanelProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isSubmitting || !canComment) return;
    setError("");
    try { await onSubmit(trimmed); setBody(""); }
    catch { setError("Could not post your comment. Your draft is still here."); }
  }

  return (
    <div className={cn("flex flex-col gap-3 border-t border-line-hair pt-4", className)}>
      {isLoading ? (
        <p className="text-xs text-ink-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-ink-muted">No comments yet, be the first.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5">
              <Avatar name={comment.author.name} size="sm" />
              <div className="flex-1 rounded-lg bg-surface-alt px-3 py-2">
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">
                    {comment.author.name}
                  </span>{" "}
                  · {formatTimeAgo(comment.createdAt)}
                </p>
                <RichContent className="mt-0.5 text-sm text-ink text-pretty" html={comment.bodyHtml} text={comment.body} projectId={projectId} />
                {comment.audioFileId ? <CommentAudio projectId={projectId} fileId={comment.audioFileId} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment ? <form onSubmit={(event) => void handleSubmit(event)} className="flex items-end gap-2">
        <ImageTextarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          className={cn(INPUT_BASE_CLASS, "min-h-24 flex-1 resize-none px-3 py-3")}
          maxLength={2000}
          projectId={projectId}
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          loading={isSubmitting}
          disabled={!body.trim()}
        >
          Post
        </Button>
      </form> : null}
      {error ? <p className="text-xs text-negative-600">{error}</p> : null}
    </div>
  );
}

CommentPanel.displayName = "CommentPanel";

export { CommentPanel, type CommentPanelProps };
