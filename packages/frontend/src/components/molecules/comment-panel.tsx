import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { formatTimeAgo } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { UpdateComment } from "@/lib/project-types";

interface CommentPanelProps {
  comments: UpdateComment[];
  isLoading?: boolean;
  isSubmitting?: boolean;
  onSubmit: (body: string) => void;
  className?: string;
}

function CommentPanel({
  comments,
  isLoading = false,
  isSubmitting = false,
  onSubmit,
  className,
}: CommentPanelProps) {
  const [body, setBody] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setBody("");
  }

  return (
    <div className={cn("flex flex-col gap-3 border-t border-[#F0F0F0] pt-4", className)}>
      {isLoading ? (
        <p className="text-xs text-gray-400">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400">No comments yet — be the first.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5">
              <Avatar name={comment.author.name} size="sm" />
              <div className="flex-1 rounded-xl bg-[#F8F8F8] px-3 py-2">
                <p className="text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-900">
                    {comment.author.name}
                  </span>{" "}
                  · {formatTimeAgo(comment.createdAt)}
                </p>
                <p className="mt-0.5 text-sm text-gray-700 text-pretty">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          className={cn(
            "flex-1 resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900",
            "outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          )}
          maxLength={2000}
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={!body.trim() || isSubmitting}
          className="h-9 px-3 text-xs"
        >
          {isSubmitting ? "Posting…" : "Post"}
        </Button>
      </form>
    </div>
  );
}

CommentPanel.displayName = "CommentPanel";

export { CommentPanel, type CommentPanelProps };
