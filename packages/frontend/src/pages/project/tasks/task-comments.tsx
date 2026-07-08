import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Avatar } from "@/components/atoms/avatar";
import { formatTimeAgo, formatShortDate } from "@/lib/formatters";
import { useTaskDetail, useAddTaskComment } from "@/hooks/use-tasks";
import { toast } from "@/lib/toast";

function formatWhen(value: string): string {
  return formatTimeAgo(value) || formatShortDate(value) || value;
}

export function TaskComments({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { data: detail } = useTaskDetail(projectId, taskId);
  const addComment = useAddTaskComment(projectId, taskId);
  const [comment, setComment] = useState("");

  function submitComment(): void {
    const body = comment.trim();
    if (!body) return;
    addComment.mutate(body, {
      onSuccess: () => setComment(""),
      onError: () => toast("Could not add comment"),
    });
  }

  return (
    <div className="flex flex-col border-t border-[#F0F0F0] pt-6">
      <h3 className="text-sm font-semibold text-gray-900">
        Comments{detail && detail.comments.length > 0 ? ` (${detail.comments.length})` : ""}
      </h3>

      {!detail?.comments || detail.comments.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="mt-4 flex max-h-64 flex-col gap-4 overflow-y-auto pr-2">
          {detail.comments.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-xl bg-[#FAFAFA] p-3">
              <Avatar name={c.authorName} size="sm" />
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                  <span className="text-xs text-gray-400">{formatWhen(c.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitComment();
            }
          }}
          rows={2}
          placeholder="Add a comment…"
          className="w-full resize-none rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={submitComment}
            disabled={!comment.trim() || addComment.isPending}
            loading={addComment.isPending}
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

TaskComments.displayName = "TaskComments";

