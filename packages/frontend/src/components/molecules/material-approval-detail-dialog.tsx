import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import {
  useAddMaterialApprovalComment,
  useMaterialApproval,
} from "@/hooks/use-material-approvals";
import { MATERIAL_APPROVAL_STATUS_META } from "./material-approval-card";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { MaterialApprovalDetail } from "@/api/material-approvals";
import { INPUT_CLASS } from "@/components/atoms/input";

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

interface SpecFact {
  label: string;
  value: string;
}

function buildSpecFacts(approval: MaterialApprovalDetail): SpecFact[] {
  const facts: SpecFact[] = [
    { label: "Material", value: approval.materialName },
    { label: "Quantity", value: `${approval.quantity} ${approval.unit}` },
  ];
  if (approval.supplier) facts.push({ label: "Supplier", value: approval.supplier });
  if (approval.neededBy) {
    facts.push({ label: "Needed by", value: formatWhen(approval.neededBy) });
  }
  if (approval.phaseName) facts.push({ label: "Phase", value: approval.phaseName });
  if (approval.activityName) facts.push({ label: "Activity", value: approval.activityName });
  return facts;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  approvalId: string | null;
  canComment?: boolean;
}

function MaterialApprovalDetailDialog({
  open,
  onOpenChange,
  projectId,
  approvalId,
  canComment = false,
}: Props) {
  const { data: approval, isPending } = useMaterialApproval(projectId, approvalId ?? undefined);
  const addComment = useAddMaterialApprovalComment();
  const [comment, setComment] = useState("");

  function submitComment(): void {
    if (!approvalId || !comment.trim()) return;
    addComment.mutate(
      { projectId, approvalId, body: comment.trim() },
      { onSuccess: () => setComment("") },
    );
  }

  const meta = approval ? MATERIAL_APPROVAL_STATUS_META[approval.status] : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(580px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden rounded-lg border border-line bg-white shadow-card outline-none",
          )}
        >
          {isPending || !approval || !meta ? (
            <div className="flex items-center justify-center p-10">
              <Spinner size="md" />
            </div>
          ) : (
            <>
              <header className="px-6 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone} size="sm">
                    <span aria-hidden="true">{meta.glyph}</span>
                    {meta.label}
                  </Badge>
                  {approval.requestedReviewerName ? (
                    <Badge tone="info" size="sm">
                      For {approval.requestedReviewerName}
                    </Badge>
                  ) : null}
                </div>
                <Dialog.Title className="mt-2 text-lg font-semibold text-gray-900">
                  {approval.title}
                </Dialog.Title>
              </header>

              <div className="mt-4 flex-1 overflow-y-auto border-t border-line-hair px-6 py-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {buildSpecFacts(approval).map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-xs font-medium uppercase text-ink-muted">
                        {fact.label}
                      </dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

                {approval.specification ? (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase text-ink-muted">
                      Specification
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {approval.specification}
                    </p>
                  </div>
                ) : null}

                {approval.description ? (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase text-ink-muted">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {approval.description}
                    </p>
                  </div>
                ) : null}

                {approval.response ? (
                  <div className="mt-5">
                    <p className="text-xs font-medium uppercase text-ink-muted">
                      Decision · {meta.label}
                    </p>
                    <div className="mt-2 rounded-lg bg-surface-alt p-3">
                      <p className="whitespace-pre-wrap text-sm text-gray-900">
                        {approval.response}
                      </p>
                      {approval.reviewedByName ? (
                        <p className="mt-1 text-xs text-gray-500">
                          {approval.reviewedByName}
                          {approval.reviewedAt ? ` · ${formatWhen(approval.reviewedAt)}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <p className="mt-5 text-xs font-medium uppercase text-ink-muted">
                  Discussion ({approval.comments.length})
                </p>
                {approval.comments.length === 0 ? (
                  <p className="py-3 text-sm text-gray-500">No comments yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-3">
                    {approval.comments.map((c) => (
                      <li key={c.id} className="rounded-lg bg-surface-alt p-3">
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

              <footer className="flex items-center gap-2 border-t border-line-hair px-6 py-4">
                {canComment ? (
                  <>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={1}
                      placeholder="Add a comment…"
                      className={cn(INPUT_CLASS, "h-auto py-3 min-h-[40px] flex-1")}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      disabled={!comment.trim()}
                      loading={addComment.isPending}
                      onClick={submitComment}
                    >
                      Send
                    </Button>
                  </>
                ) : (
                  <span className="flex-1" />
                )}
                <Dialog.Close
                  render={
                    <Button type="button" variant="secondary" size="md">
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

MaterialApprovalDetailDialog.displayName = "MaterialApprovalDetailDialog";

export { MaterialApprovalDetailDialog };
