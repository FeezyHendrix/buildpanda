import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { usePostComment, useProposalComments } from "@/hooks/use-proposals";
import { formatActivityTimestamp } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface Props {
  proposalId: string;
}

export function MessagesTab({ proposalId }: Props) {
  const { data: comments = [], isLoading } = useProposalComments(proposalId);
  const postComment = usePostComment(proposalId);
  const [body, setBody] = useState("");

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    await postComment.mutateAsync(trimmed);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="sm" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState title="No messages yet" description="Leave an internal note or message for your team." />
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">{c.authorName}</span>
                <span className="text-xs text-gray-400">{formatActivityTimestamp(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-700">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note or message…"
          className={cn(
            "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
            "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            "resize-none placeholder:text-gray-400",
          )}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!body.trim() || postComment.isPending}
          >
            {postComment.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
