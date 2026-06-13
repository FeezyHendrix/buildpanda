import { Dialog } from "@base-ui-components/react/dialog";
import { useEffect, useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  useAddQueryComment,
  useProjectQuery,
  useUpdateQuery,
} from "@/hooks/use-queries";
import { cn } from "@/lib/utils";
import type { QueryStatus } from "@/lib/project-types";

export const QUERY_STATUS_META: Record<
  QueryStatus,
  { label: string; tone: "neutral" | "info" | "success" }
> = {
  Open: { label: "Open", tone: "neutral" },
  Answered: { label: "Answered", tone: "info" },
  Closed: { label: "Closed", tone: "success" },
};

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  queryId: string | null;
}

function QueryDetailDialog({ open, onOpenChange, projectId, queryId }: Props) {
  const { data: query, isLoading } = useProjectQuery(projectId, queryId ?? undefined);
  const updateQuery = useUpdateQuery();
  const addComment = useAddQueryComment();
  const [answer, setAnswer] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setAnswer(query?.answer ?? "");
  }, [query?.answer, queryId]);

  function saveAnswer(): void {
    if (!queryId || !answer.trim()) return;
    updateQuery.mutate({ projectId, queryId, answer: answer.trim() });
  }

  function close(): void {
    if (!queryId) return;
    updateQuery.mutate({ projectId, queryId, status: "Closed" });
  }

  function submitComment(): void {
    if (!queryId || !comment.trim()) return;
    addComment.mutate({ projectId, queryId, body: comment.trim() }, { onSuccess: () => setComment("") });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(580px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
          )}
        >
          {isLoading || !query ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="px-6 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={QUERY_STATUS_META[query.status].tone} size="sm">
                    {QUERY_STATUS_META[query.status].label}
                  </Badge>
                  {query.dueDate && (
                    <span className="text-xs text-gray-500">Needed by {formatWhen(query.dueDate)}</span>
                  )}
                </div>
                <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                  {query.subject}
                </Dialog.Title>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">{query.question}</p>
              </header>

              <div className="mt-4 flex-1 overflow-y-auto border-t border-[#F0F0F0] px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Answer</p>
                {query.answer && query.status !== "Open" ? (
                  <div className="mt-2 rounded-xl bg-[#F0F4FF] p-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-900">{query.answer}</p>
                    {query.answeredByName && (
                      <p className="mt-1 text-xs text-gray-500">
                        Answered by {query.answeredByName}
                        {query.answeredAt ? ` · ${formatWhen(query.answeredAt)}` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={3}
                      placeholder="Write an answer…"
                      className="w-full rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                    />
                    <div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="h-9 px-4 text-sm"
                        disabled={!answer.trim() || updateQuery.isPending}
                        onClick={saveAnswer}
                      >
                        Save answer
                      </Button>
                    </div>
                  </div>
                )}

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Discussion ({query.comments.length})
                </p>
                {query.comments.length === 0 ? (
                  <p className="py-3 text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {query.comments.map((c) => (
                      <li key={c.id} className="rounded-xl bg-[#FAFAFA] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                          <span className="text-xs text-gray-400">{formatWhen(c.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="flex flex-col gap-2 border-t border-[#F0F0F0] px-6 py-4">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Add a comment…"
                  className="w-full rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
                <div className="flex items-center justify-end gap-2">
                  {query.status !== "Closed" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mr-auto h-9 px-4 text-sm"
                      disabled={updateQuery.isPending}
                      onClick={close}
                    >
                      Mark closed
                    </Button>
                  )}
                  <Dialog.Close
                    render={
                      <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm">
                        Close
                      </Button>
                    }
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="h-9 px-4 text-sm"
                    disabled={!comment.trim() || addComment.isPending}
                    onClick={submitComment}
                  >
                    Comment
                  </Button>
                </div>
              </footer>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

QueryDetailDialog.displayName = "QueryDetailDialog";

export { QueryDetailDialog };
