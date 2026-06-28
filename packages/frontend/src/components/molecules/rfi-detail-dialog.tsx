import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { formatShortDate } from "@/lib/formatters";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { RichTextEditor, type UploadedAttachment } from "@/components/molecules/rich-text-editor";
import {
  useConvertRfiToChange,
  useProjectRfi,
  useRespondRfi,
  useTransitionRfi,
  useUpdateRfi,
} from "@/hooks/use-rfis";
import { useProjectActivities } from "@/hooks/use-activities";
import { useActionItems } from "@/hooks/use-action-items";
import { useParticipants } from "@/hooks/use-participants";
import { cn } from "@/lib/utils";
import type { RfiStatus } from "@/lib/project-types";

export const RFI_STATUS_META: Record<
  RfiStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  Open: { label: "Open", tone: "info" },
  InReview: { label: "In review", tone: "warning" },
  Answered: { label: "Answered", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
  Void: { label: "Void", tone: "danger" },
};

interface RfiReference {
  type: "action_item" | "activity";
  id: string;
  label: string;
}

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
}

function ReferencePicker({
  projectId,
  onPick,
}: {
  projectId: string;
  onPick: (ref: RfiReference) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: activities = [] } = useProjectActivities(projectId);
  const { data: actionItems = [] } = useActionItems(projectId);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Reference an item
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-[#EDEDED] bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Reference an item</span>
        <button type="button" className="text-xs text-gray-400" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {actionItems.length > 0 && (
          <p className="px-1 py-1 text-[10px] uppercase tracking-wide text-gray-400">Action items</p>
        )}
        {actionItems.map((a) => (
          <button
            key={a.id}
            type="button"
            className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              onPick({ type: "action_item", id: a.id, label: a.title });
              setOpen(false);
            }}
          >
            {a.title}
          </button>
        ))}
        {activities.length > 0 && (
          <p className="px-1 py-1 text-[10px] uppercase tracking-wide text-gray-400">Activities</p>
        )}
        {activities.map((a) => (
          <button
            key={a.id}
            type="button"
            className="block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
            onClick={() => {
              onPick({ type: "activity", id: a.id, label: a.name });
              setOpen(false);
            }}
          >
            {a.name}
          </button>
        ))}
        {actionItems.length === 0 && activities.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-400">Nothing to reference yet.</p>
        )}
      </div>
    </div>
  );
}

function RfiDetailDialog({ open, onOpenChange, projectId, rfiId, canManage, canRespond }: Props) {
  const { data: rfi, isLoading } = useProjectRfi(projectId, rfiId ?? undefined);
  const respond = useRespondRfi();
  const transition = useTransitionRfi();
  const convert = useConvertRfiToChange();
  const updateRfi = useUpdateRfi();
  const { data: participants = [] } = useParticipants(projectId);

  const assigneeOptions = participants
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId as string, name: p.name ?? p.email }));

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
            "overflow-hidden border-l border-[#EDEDED] bg-white shadow-2xl outline-none",
          )}
        >
          {isLoading || !rfi ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : (
            <>
              <header className="border-b border-[#F0F0F0] px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">RFI-{rfi.number}</span>
                    <Badge tone={RFI_STATUS_META[rfi.status].tone} size="sm">
                      {RFI_STATUS_META[rfi.status].label}
                    </Badge>
                    {rfi.priority === "High" && <Badge tone="danger" size="sm">High priority</Badge>}
                    {canManage ? (
                      <select
                        className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs text-gray-700 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
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
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-600">{rfi.question}</p>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {rfi.officialResponse && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Official response
                    </p>
                    <div className="mt-2 rounded-xl bg-[#F0F4FF] p-3">
                      <p className="whitespace-pre-wrap text-sm text-gray-900">{rfi.officialResponse}</p>
                      {rfi.officialRespondedByName && (
                        <p className="mt-1 text-xs text-gray-500">
                          {rfi.officialRespondedByName}
                          {rfi.officialRespondedAt ? ` · ${formatWhen(rfi.officialRespondedAt)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Responses &amp; comments
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {rfi.comments.length === 0 && (
                    <p className="text-sm text-gray-400">No responses yet.</p>
                  )}
                  {rfi.comments.map((c) => (
                    <div key={c.id} className="rounded-xl border border-[#F0F0F0] p-3">
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
                      {c.references && c.references.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.references.map((r, i) => (
                            <Badge key={i} tone="accent" size="sm">
                              {r.type === "action_item" ? "Action" : "Activity"}: {r.label}
                            </Badge>
                          ))}
                        </div>
                      )}
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
                    {references.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {references.map((r, i) => (
                          <Badge key={i} tone="accent" size="sm">
                            {r.type === "action_item" ? "Action" : "Activity"}: {r.label}
                            <button
                              type="button"
                              className="ml-1"
                              onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
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
              </div>

              {canManage && (
                <footer className="flex flex-wrap items-center gap-2 border-t border-[#F0F0F0] px-6 py-4">
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
                  {isClosed && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => transition.mutate({ projectId, rfiId: rfi.id, status: "Open" })}
                      loading={transition.isPending}
                    >
                      Reopen
                    </Button>
                  )}
                  {(rfi.costImpact || rfi.scheduleImpact) && !rfi.changeRequestId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => convert.mutate({ projectId, rfiId: rfi.id })}
                      loading={convert.isPending}
                    >
                      Convert to change event
                    </Button>
                  )}
                  {rfi.changeRequestId && (
                    <span className="text-xs text-gray-500">Linked to a change event</span>
                  )}
                </footer>
              )}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

RfiDetailDialog.displayName = "RfiDetailDialog";

export { RfiDetailDialog };
