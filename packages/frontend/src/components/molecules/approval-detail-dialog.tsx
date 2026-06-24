import { Dialog } from "@base-ui-components/react/dialog";
import { useEffect, useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  useAddApprovalComment,
  useApproval,
  useUpdateApproval,
} from "@/hooks/use-approvals";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { ApprovalStatus } from "@/lib/project-types";

export const APPROVAL_STATUS_META: Record<
  ApprovalStatus,
  { label: string; tone: "neutral" | "success" | "danger" | "warning" }
> = {
  Pending: { label: "Pending", tone: "neutral" },
  Approved: { label: "Approved", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
  Resubmit: { label: "Resubmit", tone: "warning" },
};

const DECISION_TOAST: Record<ApprovalStatus, string> = {
  Pending: "Approval reopened",
  Approved: "Approval approved",
  Rejected: "Approval rejected",
  Resubmit: "Resubmission requested",
};

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  approvalId: string | null;
  canDecide?: boolean;
  currentUserId?: string;
}

function ApprovalDetailDialog({ open, onOpenChange, projectId, approvalId, canDecide = false, currentUserId }: Props) {
  const { data: approval, isLoading } = useApproval(projectId, approvalId ?? undefined);
  const updateApproval = useUpdateApproval();
  const addComment = useAddApprovalComment();
  const [response, setResponse] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setResponse(approval?.response ?? "");
  }, [approval?.response, approvalId]);

  function decide(status: ApprovalStatus): void {
    if (!approvalId) return;
    updateApproval.mutate(
      { projectId, approvalId, status, response: response.trim() || null },
      {
        onSuccess: () => {
          toast(DECISION_TOAST[status], "success");
          onOpenChange(false);
        },
        onError: () => toast("Could not record the decision"),
      },
    );
  }

  function submitComment(): void {
    if (!approvalId || !comment.trim()) return;
    addComment.mutate({ projectId, approvalId, body: comment.trim() }, { onSuccess: () => setComment("") });
  }

  const decided = approval && approval.status !== "Pending";
  // Mirror the backend gate: the user may decide only if they are an approver,
  // and when a specific reviewer was requested it must be them.
  const mayDecide =
    canDecide &&
    (!approval?.requestedReviewerId || approval.requestedReviewerId === currentUserId);

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
          {isLoading || !approval ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="px-6 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={APPROVAL_STATUS_META[approval.status].tone} size="sm">
                    {APPROVAL_STATUS_META[approval.status].label}
                  </Badge>
                  {approval.category && <Badge tone="neutral" size="sm">{approval.category}</Badge>}
                  {approval.requestedReviewerName && (
                    <Badge tone="info" size="sm">For {approval.requestedReviewerName}</Badge>
                  )}
                  {approval.dueDate && (
                    <span className="text-xs text-gray-500">Needed by {formatWhen(approval.dueDate)}</span>
                  )}
                </div>
                <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                  {approval.title}
                </Dialog.Title>
                {approval.description && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">{approval.description}</p>
                )}
              </header>

              <div className="mt-4 flex-1 overflow-y-auto border-t border-[#F0F0F0] px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {decided ? `Decision · ${APPROVAL_STATUS_META[approval.status].label}` : "Decision"}
                </p>
                {decided && approval.response ? (
                  <div className="mt-2 rounded-xl bg-[#FAFAFA] p-3">
                    <p className="whitespace-pre-wrap text-sm text-gray-900">{approval.response}</p>
                    {approval.reviewedByName && (
                      <p className="mt-1 text-xs text-gray-500">
                        {approval.reviewedByName}
                        {approval.reviewedAt ? ` · ${formatWhen(approval.reviewedAt)}` : ""}
                      </p>
                    )}
                  </div>
                ) : null}
                {mayDecide ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={2}
                      placeholder="Add a note for your decision (optional)"
                      className="w-full rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="primary" size="sm" className="h-9 px-4 text-sm" loading={updateApproval.isPending} onClick={() => decide("Approved")}>
                        {approval.status === "Approved" ? "Approved" : "Approve"}
                      </Button>
                      <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm" loading={updateApproval.isPending} onClick={() => decide("Resubmit")}>
                        Request resubmit
                      </Button>
                      <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm text-red-600" loading={updateApproval.isPending} onClick={() => decide("Rejected")}>
                        {approval.status === "Rejected" ? "Rejected" : "Reject"}
                      </Button>
                    </div>
                    {decided && (
                      <p className="text-xs text-gray-400">This approval is {APPROVAL_STATUS_META[approval.status].label.toLowerCase()}. Choosing a different outcome updates the decision.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    {!decided && approval.requestedReviewerName
                      ? `Awaiting a decision from ${approval.requestedReviewerName}.`
                      : decided
                        ? "This decision has been recorded."
                        : "You do not have permission to decide this approval."}
                  </p>
                )}

                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Discussion ({approval.comments.length})
                </p>
                {approval.comments.length === 0 ? (
                  <p className="py-3 text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {approval.comments.map((c) => (
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
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="h-9 px-4 text-sm"
                  disabled={!comment.trim()} loading={addComment.isPending}
                  onClick={submitComment}
                >
                  Send
                </Button>
                <Dialog.Close
                  render={
                    <Button type="button" variant="secondary" size="sm" className="h-9 px-4 text-sm">
                      Close
                    </Button>
                  }
                />
              </footer>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

ApprovalDetailDialog.displayName = "ApprovalDetailDialog";

export { ApprovalDetailDialog };
