import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { RichTextEditor, type UploadedAttachment } from "@/components/molecules/rich-text-editor";
import {
  useProjectRfi,
  useRespondRfi,
  useTransitionRfi,
  useUpdateRfi,
} from "@/hooks/use-rfis";
import { useParticipants } from "@/hooks/use-participants";
import { errorMessage } from "@/lib/api-error";
import { isRfiOverdue, overdueLabel, rfiOverdueDays, RFI_STATUS_META } from "@/lib/rfi-meta";
import { cn } from "@/lib/utils";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import {
  ReferenceChips,
  ReferencePicker,
  type RfiReference,
} from "./rfi-detail/reference-picker";
import { RfiAuditTrail } from "./rfi-detail/rfi-audit-trail";
import { ConvertToChangeDialog } from "./rfi-detail/convert-to-change-dialog";

export { RFI_STATUS_META };

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rfiId: string | null;
  canManage: boolean;
  canRespond: boolean;
  /** Opens the edit drawer for this RFI; omit to hide the action. */
  onEdit?: (rfiId: string) => void;
}

function RfiDetailDialog({ open, onOpenChange, projectId, rfiId, canManage, canRespond, onEdit }: Props) {
  const { data: rfi, isLoading } = useProjectRfi(projectId, rfiId ?? undefined);
  const respond = useRespondRfi();
  const transition = useTransitionRfi();
  const updateRfi = useUpdateRfi();
  const [convertOpen, setConvertOpen] = useState(false);
  const { data: participants = [] } = useParticipants(projectId);

  // Invited participants are assignable: the ball can sit with the RE before
  // she has ever signed in (finding F33).
  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({
      id: p.userId as string,
      name: p.status === "invited" ? `${p.name ?? p.email} (invited)` : (p.name ?? p.email),
    }));

  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [official, setOfficial] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [references, setReferences] = useState<RfiReference[]>([]);
  const [editorKey, setEditorKey] = useState(0);

  function resetEditor(): void {
    setHtml("");
    setText("");
    setOfficial(false);
    setAttachments([]);
    setReferences([]);
    setEditorKey((k) => k + 1);
  }

  function submitResponse(): void {
    if (!rfi || text.trim() === "") return;
    respond.mutate(
      {
        projectId,
        rfiId: rfi.id,
        body: text,
        contentHtml: html,
        official: official && canManage,
        attachments,
        references,
      },
      { onSuccess: resetEditor },
    );
  }

  const isClosed = rfi?.status === "Closed" || rfi?.status === "Void";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh w-[60vw] min-w-[420px] max-w-[1100px] flex-col",
            "overflow-hidden border-l border-line-hair bg-white shadow-lg outline-none",
          )}
        >
          {isLoading || !rfi ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="border-b border-line-hair px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">RFI-{rfi.number}</span>
                    <Badge tone={RFI_STATUS_META[rfi.status].tone} size="sm">
                      {RFI_STATUS_META[rfi.status].label}
                    </Badge>
                    {rfi.priority === "High" && <Badge tone="danger" size="sm">High priority</Badge>}
                    {canManage ? (
                      <select
                        className={INPUT_SM_CLASS}
                        value={rfi.ballInCourtId ?? ""}
                        disabled={updateRfi.isPending}
                        onChange={(e) =>
                          updateRfi.mutate({
                            projectId,
                            rfiId: rfi.id,
                            ballInCourtId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {assigneeOptions.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      rfi.ballInCourtName && (
                        <span className="text-xs text-gray-500">Ball in court: {rfi.ballInCourtName}</span>
                      )
                    )}
                    {rfi.dueDate && (
                      <span className="text-xs text-gray-500">Due {formatWhen(rfi.dueDate)}</span>
                    )}
                    {isRfiOverdue(rfi) ? (
                      <Badge tone="danger" size="sm">⚠ {overdueLabel(rfiOverdueDays(rfi))}</Badge>
                    ) : null}
                    {rfi.reopenedCount > 0 ? (
                      <Badge tone="warning" size="sm">↻ Reopened ×{rfi.reopenedCount}</Badge>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-gray-400 hover:text-gray-700"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </button>
                </div>
                <Dialog.Title className="mt-2 text-xl font-semibold text-gray-900">
                  {rfi.subject}
                </Dialog.Title>
                {rfi.questionHtml ? (
                  <div
                    className="prose prose-sm mt-1.5 max-w-none text-sm text-gray-600 [&_img]:max-h-64 [&_img]:rounded"
                    dangerouslySetInnerHTML={{ __html: rfi.questionHtml }}
                  />
                ) : (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">{rfi.question}</p>
                )}
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {rfi.officialResponse && (
                  <div className="mb-4">
                    <p className="text-xs font-medium uppercase text-ink-muted">
                      Official response
                    </p>
                    <div className="mt-2 rounded-lg bg-primary-50 p-3">
                      {rfi.officialResponseHtml ? (
                        <div
                          className="prose prose-sm max-w-none text-sm text-gray-900 [&_img]:max-h-64 [&_img]:rounded"
                          dangerouslySetInnerHTML={{ __html: rfi.officialResponseHtml }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-gray-900">{rfi.officialResponse}</p>
                      )}
                      {rfi.officialRespondedByName && (
                        <p className="mt-1 text-xs text-gray-500">
                          {rfi.officialRespondedByName}
                          {rfi.officialRespondedAt ? ` · ${formatWhen(rfi.officialRespondedAt)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs font-medium uppercase text-ink-muted">
                  Responses &amp; comments
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {rfi.comments.length === 0 && (
                    <p className="text-sm text-gray-400">No responses yet.</p>
                  )}
                  {rfi.comments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-line-hair p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{c.authorName}</span>
                        {c.isProposedResponse && <Badge tone="warning" size="sm">Proposed</Badge>}
                      </div>
                      {c.contentHtml ? (
                        <div
                          className="prose prose-sm mt-1 max-w-none text-sm text-gray-600 [&_img]:max-h-64 [&_img]:rounded"
                          dangerouslySetInnerHTML={{ __html: c.contentHtml }}
                        />
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{c.body}</p>
                      )}
                      {c.references && c.references.length > 0 ? (
                        <div className="mt-2">
                          <ReferenceChips references={c.references as RfiReference[]} />
                        </div>
                      ) : null}
                      <p className="mt-1 text-xs text-gray-400">{formatWhen(c.createdAt)}</p>
                    </div>
                  ))}
                </div>

                {canRespond && !isClosed && (
                  <div className="mt-4 flex flex-col gap-2">
                    <RichTextEditor
                      key={editorKey}
                      value={html}
                      onChange={(h, t) => {
                        setHtml(h);
                        setText(t);
                      }}
                      onAttach={(a) => setAttachments((prev) => [...prev, a])}
                      placeholder="Write a response…"
                    />
                    <ReferenceChips
                      references={references}
                      onRemove={(index) => setReferences((prev) => prev.filter((_, j) => j !== index))}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <ReferencePicker
                        projectId={projectId}
                        onPick={(ref) => setReferences((prev) => [...prev, ref])}
                      />
                      {canManage && (
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={official}
                            onChange={(e) => setOfficial(e.target.checked)}
                          />
                          Post as the official response
                        </label>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        className="ml-auto"
                        onClick={submitResponse}
                        loading={respond.isPending}
                        disabled={text.trim() === ""}
                      >
                        {official && canManage ? "Post official response" : "Add response"}
                      </Button>
                    </div>
                  </div>
                )}

                <RfiAuditTrail projectId={projectId} rfiId={rfi.id} />
              </div>

              {canManage && (
                <footer className="flex flex-wrap items-center gap-2 border-t border-line-hair px-6 py-4">
                  {onEdit && !isClosed ? (
                    <Button variant="secondary" size="sm" onClick={() => onEdit(rfi.id)}>
                      Edit RFI
                    </Button>
                  ) : null}
                  {!isClosed && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => transition.mutate({ projectId, rfiId: rfi.id, status: "Closed" })}
                      loading={transition.isPending}
                    >
                      Close RFI
                    </Button>
                  )}
                  {/* An answer that does not settle the question is reopened, not re-raised. */}
                  {isClosed || rfi.status === "Answered" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => transition.mutate({ projectId, rfiId: rfi.id, status: "Open" })}
                      loading={transition.isPending}
                    >
                      Reopen
                    </Button>
                  ) : null}
                  {(rfi.costImpact || rfi.scheduleImpact) && !rfi.changeRequestId && (
                    <Button variant="secondary" size="sm" onClick={() => setConvertOpen(true)}>
                      Convert to change event
                    </Button>
                  )}
                  {rfi.changeRequestId && (
                    <span className="text-xs text-gray-500">Linked to a change event</span>
                  )}
                  {transition.error ? (
                    <span className="text-xs text-negative-600">{errorMessage(transition.error)}</span>
                  ) : null}
                </footer>
              )}
              <ConvertToChangeDialog
                open={convertOpen}
                onOpenChange={setConvertOpen}
                projectId={projectId}
                rfiId={rfi.id}
                rfiNumber={rfi.number}
                rfiSubject={rfi.subject}
              />
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

RfiDetailDialog.displayName = "RfiDetailDialog";

export { RfiDetailDialog };
