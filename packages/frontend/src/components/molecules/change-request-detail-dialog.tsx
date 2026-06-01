import { Dialog } from "@base-ui-components/react/dialog";
import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  useAddChangeComment,
  useChangeRequest,
  useUpdateChangeRequest,
} from "@/hooks/use-change-requests";
import { cn } from "@/lib/utils";
import type { ChangeStatus } from "@/lib/project-mock-data";

export const CHANGE_STATUS_META: Record<
  ChangeStatus,
  { label: string; tone: "neutral" | "info" | "success" | "danger" }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  Submitted: { label: "Submitted", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
};

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  changeId: string | null;
}

function ChangeRequestDetailDialog({ open, onOpenChange, projectId, changeId }: Props) {
  const { data: cr, isLoading } = useChangeRequest(projectId, changeId ?? undefined);
  const update = useUpdateChangeRequest();
  const addComment = useAddChangeComment();
  const [comment, setComment] = useState("");

  function decide(status: ChangeStatus): void {
    if (!changeId) return;
    update.mutate({ projectId, changeId, status });
  }

  function submitComment(): void {
    if (!changeId || !comment.trim()) return;
    addComment.mutate({ projectId, changeId, body: comment.trim() }, { onSuccess: () => setComment("") });
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
          {isLoading || !cr ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="px-6 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={CHANGE_STATUS_META[cr.status].tone} size="sm">
                    {CHANGE_STATUS_META[cr.status].label}
                  </Badge>
                  <span className="text-xs font-medium text-gray-900">{money(cr.costImpact, cr.currency)}</span>
                  {cr.timeImpactDays > 0 && <span className="text-xs text-gray-500">+{cr.timeImpactDays} days</span>}
                </div>
                <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">{cr.title}</Dialog.Title>
                {cr.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">{cr.description}</p>}
                {cr.reason && <p className="mt-1 text-xs text-gray-500">Reason: {cr.reason}</p>}
                {cr.decidedByName && (
                  <p className="mt-1 text-xs text-gray-500">
                    {cr.status} by {cr.decidedByName}
                    {cr.decidedAt ? ` · ${formatWhen(cr.decidedAt)}` : ""}
                  </p>
                )}
              </header>

              <div className="mt-4 flex-1 overflow-y-auto border-t border-[#F0F0F0] px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {cr.status === "Draft" && (
                    <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm" disabled={update.isPending} onClick={() => decide("Submitted")}>
                      Submit for decision
                    </Button>
                  )}
                  {cr.status !== "Approved" && (
                    <Button type="button" variant="primary" size="sm" className="h-9 px-4 text-sm" disabled={update.isPending} onClick={() => decide("Approved")}>
                      Approve
                    </Button>
                  )}
                  {cr.status !== "Rejected" && (
                    <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm text-red-600" disabled={update.isPending} onClick={() => decide("Rejected")}>
                      Reject
                    </Button>
                  )}
                </div>

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Discussion ({cr.comments.length})
                </p>
                {cr.comments.length === 0 ? (
                  <p className="py-3 text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {cr.comments.map((c) => (
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

              <footer className="flex items-center gap-2 border-t border-[#F0F0F0] px-6 py-4">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={1}
                  placeholder="Add a comment…"
                  className="min-h-[40px] flex-1 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                />
                <Button type="button" variant="primary" size="sm" className="h-9 px-4 text-sm" disabled={!comment.trim() || addComment.isPending} onClick={submitComment}>
                  Send
                </Button>
                <Dialog.Close render={<Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm">Close</Button>} />
              </footer>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

ChangeRequestDetailDialog.displayName = "ChangeRequestDetailDialog";

export { ChangeRequestDetailDialog };
