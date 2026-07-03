import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { useActionItem, useAddActionComment } from "@/hooks/use-action-items";
import { cn } from "@/lib/utils";
import type { ActionPriority, ActionStatus } from "@/lib/project-types";

export const ACTION_STATUS_META: Record<
  ActionStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" }
> = {
  Open: { label: "Open", tone: "neutral" },
  InProgress: { label: "In progress", tone: "info" },
  Blocked: { label: "Blocked", tone: "warning" },
  Resolved: { label: "Resolved", tone: "success" },
};

export const ACTION_PRIORITY_META: Record<
  ActionPriority,
  { tone: "neutral" | "info" | "warning" | "danger" }
> = {
  Low: { tone: "neutral" },
  Medium: { tone: "info" },
  High: { tone: "warning" },
  Urgent: { tone: "danger" },
};

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  itemId: string | null;
}

function ActionItemDetailDialog({ open, onOpenChange, projectId, itemId }: Props) {
  const { data: item, isLoading } = useActionItem(projectId, itemId ?? undefined);
  const addComment = useAddActionComment();
  const [comment, setComment] = useState("");

  function submitComment(): void {
    if (!itemId || !comment.trim()) return;
    addComment.mutate(
      { projectId, itemId, body: comment.trim() },
      { onSuccess: () => setComment("") },
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-2xl bg-white shadow-xl outline-none",
          )}
        >
          {isLoading || !item ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="px-6 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ACTION_STATUS_META[item.status].tone} size="sm">
                    {ACTION_STATUS_META[item.status].label}
                  </Badge>
                  <Badge tone={ACTION_PRIORITY_META[item.priority].tone} size="sm">
                    {item.priority}
                  </Badge>
                  {item.dueDate && (
                    <span className="text-xs text-gray-500">Due {formatWhen(item.dueDate)}</span>
                  )}
                </div>
                <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                  {item.title}
                </Dialog.Title>
                {item.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">
                    {item.description}
                  </p>
                )}
              </header>

              <div className="mt-4 flex-1 overflow-y-auto border-t border-[#F0F0F0] px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Comments ({item.comments.length})
                </p>
                {item.comments.length === 0 ? (
                  <p className="py-4 text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {item.comments.map((c) => (
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
                    loading={addComment.isPending}
                    disabled={!comment.trim()}
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

ActionItemDetailDialog.displayName = "ActionItemDetailDialog";

export { ActionItemDetailDialog };
