import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { QueryError } from "@/components/molecules/query-error";
import type { Rfi } from "@/lib/project-types";
import { useProjectRfi, useRfiEvents, useTransitionRfi, useUpdateRfi } from "@/hooks/use-rfis";
import { useParticipants } from "@/hooks/use-participants";
import { errorMessage } from "@/lib/api-error";
import { RFI_STATUS_META } from "@/lib/rfi-meta";
import { ConvertToChangeDialog } from "./rfi-detail/convert-to-change-dialog";
import { RfiResponses } from "./rfi-detail/rfi-responses";
import { RfiSummary } from "./rfi-detail/rfi-summary";

export { RFI_STATUS_META };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rfiId: string | null;
  canManage: boolean;
  canRespond: boolean;
  /** Opens the edit drawer for this RFI; omit to hide the action. */
  onEdit?: (rfi: Rfi) => void;
}

const TEXT_ACTION = "text-[12px] font-medium text-[#1E1E1E] underline-offset-2 outline-none hover:underline focus-visible:underline";

/**
 * One RFI: the record on the left (with the action that closes or reopens it) and
 * the conversation on the right. Closing and reopening are decisions only a manager takes.
 */
function RfiDetailDialog({ open, onOpenChange, projectId, rfiId, canManage, canRespond, onEdit }: Props) {
  const { data: rfi, error, refetch } = useProjectRfi(projectId, rfiId ?? undefined);
  const { data: events = [] } = useRfiEvents(projectId, rfiId ?? undefined);
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

  const isClosed = rfi?.status === "Closed" || rfi?.status === "Void";
  const creator = rfi?.createdById ? participants.find((p) => p.userId === rfi.createdById) : undefined;
  const creatorName =
    (creator ? (creator.name ?? creator.email) : null) ?? events.find((e) => e.type === "created")?.actorLabel ?? null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 flex w-[min(772px,100vw)] flex-col overflow-y-auto bg-white shadow-xl outline-none lg:flex-row lg:overflow-hidden">
          {error || !rfi ? (
            <RfiLoadState error={error} retry={refetch} onClose={() => onOpenChange(false)} />
          ) : (
            <>
              <div className="flex shrink-0 flex-col bg-white lg:min-h-0 lg:w-[430px]">
                <div className="px-[24px] pb-[24px] pt-[40px] lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  <Dialog.Title className="sr-only">{`RFI-${rfi.number}: ${rfi.subject}`}</Dialog.Title>
                  <RfiSummary
                    rfi={rfi}
                    projectId={projectId}
                    creatorName={creatorName}
                    canAssign={canManage}
                    assigneeOptions={assigneeOptions}
                    assigning={updateRfi.isPending}
                    onAssign={(ballInCourtId) => updateRfi.mutate({ projectId, rfiId: rfi.id, ballInCourtId })}
                  />

                  {canManage ? (
                    <div className="mt-[16px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px]">
                      {onEdit && !isClosed ? (
                        <button type="button" className={TEXT_ACTION} onClick={() => onEdit(rfi)}>
                          Edit RFI
                        </button>
                      ) : null}
                      {/* An answer that does not settle the question is reopened, not re-raised. */}
                      {rfi.status === "Answered" ? (
                        <button
                          type="button"
                          className={TEXT_ACTION}
                          disabled={transition.isPending}
                          onClick={() => transition.mutate({ projectId, rfiId: rfi.id, status: "Open" })}
                        >
                          Reopen RFI
                        </button>
                      ) : null}
                      {(rfi.costImpact || rfi.scheduleImpact) && !rfi.changeRequestId ? (
                        <button type="button" className={TEXT_ACTION} onClick={() => setConvertOpen(true)}>
                          Convert to change event
                        </button>
                      ) : null}
                      {rfi.changeRequestId ? (
                        <span className="text-[12px] text-[#737373]">Linked to a change event</span>
                      ) : null}
                      {transition.error ? (
                        <span className="text-[12px] text-[#E7000B]">{errorMessage(transition.error)}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <footer className="flex shrink-0 flex-col gap-[3px] px-[24px] pb-[17px] pt-[8px]">
                  {canManage ? (
                    <Button
                      type="button"
                      variant="primary"
                      loading={transition.isPending}
                      onClick={() => transition.mutate({ projectId, rfiId: rfi.id, status: isClosed ? "Open" : "Closed" })}
                      className="h-[46px] w-full text-[14px]"
                    >
                      {isClosed ? "Reopen RFI" : "Mark as closed"}
                    </Button>
                  ) : null}
                  <Dialog.Close
                    render={
                      <Button type="button" variant="ghost" className="h-[46px] w-full text-[14px] text-[#1E1E1E]">
                        Cancel
                      </Button>
                    }
                  />
                </footer>
              </div>

              <RfiResponses rfi={rfi} projectId={projectId} canRespond={canRespond} canManage={canManage} closed={isClosed} />

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

function RfiLoadState({ error, retry, onClose }: { error: unknown; retry: () => unknown; onClose: () => void }) {
  return <div className="flex flex-col items-center gap-4 p-6">
    <Dialog.Title className="sr-only">RFI details</Dialog.Title>
    {error ? <QueryError error={error} retry={retry} noun="this RFI" /> : <Spinner size="md" />}
    <Button variant="secondary" onClick={onClose}>Return to RFIs</Button>
  </div>;
}

export { RfiDetailDialog };
