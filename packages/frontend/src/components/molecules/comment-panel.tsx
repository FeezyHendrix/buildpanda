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
        <p className="text-xs text-gray-400">No comments yet, be the first.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2.5">
              <Avatar name={comment.author.name} size="sm" className='size-8 border-[0.5px] border-primary !text-caption-m' />
              <div className="flex-1 bg-grey-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">
                  <span className="text-caption-m font-semibold text-black-500 capitalize">
                    {comment.author.name}
                  </span>{" "}
                  · {formatTimeAgo(comment.createdAt)}
                </p>
                <p className="mt-0.5 text-caption-m text-grey-450 text-pretty">
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
            "flex-1 h-9 resize-none border-[0.5px] border-border px-3 py-2 text-sm text-gray-900",
            "outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10",
          )}
          maxLength={2000}
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          loading={isSubmitting}
          disabled={!body.trim()}
          className="h-9 px-3 text-caption-l"
        >
          Post
        </Button>
      </form>
    </div>
  );
}

CommentPanel.displayName = "CommentPanel";

export { CommentPanel, type CommentPanelProps };
