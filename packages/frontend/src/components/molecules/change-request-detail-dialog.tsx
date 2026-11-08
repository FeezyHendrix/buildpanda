import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { INPUT_BASE_CLASS } from "@/components/atoms/input";
import { useAddChangeComment, useChangeRequest } from "@/hooks/use-change-requests";
import { ChangeRequestActions } from "@/components/molecules/change-request-actions";
import { ChangeRequestBudgetAllocations } from "@/components/molecules/change-request-budget-allocations";
import {
  ChangeClaimDelays,
  ChangeRequestLinks,
  ChangeRequestRevisions,
  ChangeTypeBadge,
} from "@/components/molecules/change-request-context";
import { InfoCard } from "@/components/molecules/rfi-detail/info-card";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequestDetail, ChangeStatus } from "@/lib/project-types";

export const CHANGE_STATUS_META: Record<
  ChangeStatus,
  { label: string; tone: "neutral" | "info" | "success" | "accent" | "danger" }
> = {
  Draft: { label: "Draft", tone: "neutral" },
  Submitted: { label: "Submitted", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Executed: { label: "Executed", tone: "accent" },
  Rejected: { label: "Rejected", tone: "danger" },
};

/** The status as a small pill — shared by the register rows and this modal. */
export const CHANGE_STATUS_PILL: Record<ChangeStatus, string> = {
  Draft: "border-transparent bg-[#F5F5F5] text-[#737373]",
  Submitted: "border-transparent bg-[#E6EDFD] text-[#004DE7]",
  Approved: "border-[#DCF5E4] bg-[#F0FDF4] text-[#00A63E]",
  Executed: "border-transparent bg-[#F6EEFD] text-[#5D5FEF]",
  Rejected: "border-[#FFD9D9] bg-[#FEF2F2] text-[#E7000B]",
};

const VALUE_CLASS = "mt-[2px] text-[14px] leading-[20px] text-[#1E1E1E]";
const CELL_CLASS = "min-h-[56px] py-[8px]";

function formatWhen(value: string): string {
  return formatShortDate(value) || value;
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** What the change costs and moves: money and days, or days claimed against days awarded for a time claim. */
function ImpactCells({ cr }: { cr: ChangeRequestDetail }) {
  if (cr.type === "eot_only") {
    return (
      <>
        <InfoCard label="Days Claimed" className={CELL_CLASS}>
          <p className={VALUE_CLASS}>{days(cr.timeImpactDays)}</p>
        </InfoCard>
        <InfoCard label="Days Awarded" className={CELL_CLASS}>
          <p className={VALUE_CLASS}>{cr.daysAwarded === null ? "Not yet awarded" : days(cr.daysAwarded)}</p>
        </InfoCard>
      </>
    );
  }
  return (
    <>
      <InfoCard label="Cost Impact" className={CELL_CLASS}>
        <p className={cn(VALUE_CLASS, "tabular-nums")}>{formatWholeCurrency(cr.costImpact, cr.currency)}</p>
      </InfoCard>
      <InfoCard label="Time Impact" className={CELL_CLASS}>
        <p className={VALUE_CLASS}>{cr.timeImpactDays > 0 ? `+${days(cr.timeImpactDays)}` : "None"}</p>
      </InfoCard>
    </>
  );
}

function Discussion({ projectId, cr }: { projectId: string; cr: ChangeRequestDetail }) {
  const addComment = useAddChangeComment();
  const [comment, setComment] = useState("");

  function submitComment(): void {
    if (!comment.trim()) return;
    addComment.mutate(
      { projectId, changeId: cr.id, body: { content: comment.trim() } },
      {
        onSuccess: () => setComment(""),
        onError: (error) => toast(getApiErrorMessage(error), "error"),
      },
    );
  }

  return (
    <div className="mt-5">
      <p className="text-[12px] font-semibold uppercase leading-[16px] tracking-[0.08em] text-[#737373]">
        Discussion ({cr.comments.length})
      </p>
      {cr.comments.length === 0 ? (
        <p className="py-3 text-[14px] text-[#737373]">No comments yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {cr.comments.map((c) => (
            <li key={c.id} className="border border-[#EEEEEE] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-[#1E1E1E]">{c.authorName}</span>
                <span className="text-[12px] text-[#737373]">{formatWhen(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[14px] text-[#404040]">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={1}
          placeholder="Add a comment…"
          className={cn(INPUT_BASE_CLASS, "min-h-[40px] flex-1 px-3 py-2")}
        />
        <Button type="button" variant="primary" size="md" disabled={!comment.trim()} loading={addComment.isPending} onClick={submitComment}>
          Send
        </Button>
      </div>
    </div>
  );
}

function ReasonValue({ cr }: { cr: ChangeRequestDetail }): ReactNode {
  if (cr.reasonHtml) {
    return (
      <div
        className="prose prose-sm max-w-none text-[14px] leading-[20px] text-[#1E1E1E] [&>p]:my-0 [&_img]:max-h-64"
        dangerouslySetInnerHTML={{ __html: cr.reasonHtml }}
      />
    );
  }
  return <p className="text-[14px] leading-[20px] text-[#1E1E1E]">{cr.reason ?? "—"}</p>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  changeId: string | null;
}

function ChangeRequestDetailDialog({ open, onOpenChange, projectId, changeId }: Props) {
  const { data: cr, isLoading } = useChangeRequest(projectId, changeId ?? undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const createdBy = cr?.createdByName ?? "—";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(548px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col",
            "overflow-hidden border border-[#EEEEEE] bg-white shadow-lg outline-none",
          )}
        >
          {isLoading || !cr ? (
            <div className="p-8 text-center text-[14px] text-[#737373]">Loading…</div>
          ) : (
            <>
              <header className="relative shrink-0 px-[24px] pt-[24px]">
                <div className="flex flex-wrap items-center gap-[8px] pr-[40px]">
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center rounded-full border px-[10px] text-[12px] font-medium leading-[16px]",
                      CHANGE_STATUS_PILL[cr.status],
                    )}
                  >
                    {CHANGE_STATUS_META[cr.status].label}
                  </span>
                  <ChangeTypeBadge type={cr.type} />
                </div>
                <Dialog.Close
                  aria-label="Close"
                  className="absolute right-[24px] top-[24px] flex size-[24px] items-center justify-center text-[#737373] outline-none hover:text-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-gray-900/10"
                >
                  <X className="size-[20px]" strokeWidth={1.5} />
                </Dialog.Close>
                <Dialog.Title className="mt-[10px] text-[20px] font-bold leading-[28px] tracking-[-0.02em] text-[#111111]">
                  {cr.title}
                </Dialog.Title>
                {cr.description ? (
                  <p className="mt-[2px] whitespace-pre-wrap text-[14px] leading-[20px] text-[#737373]">{cr.description}</p>
                ) : null}
              </header>

              <div className="mt-[24px] flex-1 overflow-y-auto px-[24px] pb-[16px]">
                <div className="grid grid-cols-2 gap-[12px]">
                  <InfoCard label="Created by" className={CELL_CLASS}>
                    <p className={VALUE_CLASS}>{createdBy}</p>
                  </InfoCard>
                  <InfoCard label="Assigned to" className={CELL_CLASS}>
                    <p className={VALUE_CLASS}>{cr.assigneeName ?? "Unassigned"}</p>
                  </InfoCard>
                  <ImpactCells cr={cr} />
                  <InfoCard label="Reason" labelClassName="text-[14px]" className="col-span-2 min-h-[79px] py-[16px]">
                    <div className="mt-[8px]">
                      <ReasonValue cr={cr} />
                    </div>
                  </InfoCard>
                  {cr.decidedByName ? (
                    <InfoCard label="Decision" className={cn(CELL_CLASS, "col-span-2")}>
                      <p className={VALUE_CLASS}>
                        {cr.status} by {cr.decidedByName}
                        {cr.decidedAt ? ` · ${formatWhen(cr.decidedAt)}` : ""}
                      </p>
                      {cr.rejectedReason ? <p className="mt-[2px] text-[14px] leading-[20px] text-[#E7000B]">{cr.rejectedReason}</p> : null}
                    </InfoCard>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  aria-expanded={detailsOpen}
                  className="mt-[16px] flex items-center gap-[6px] text-[12px] font-semibold leading-[16px] text-[#004DE7] outline-none hover:underline"
                >
                  Details and discussion ({cr.comments.length})
                  <ChevronDown className={cn("size-[14px] transition-transform", detailsOpen && "rotate-180")} aria-hidden />
                </button>

                {detailsOpen ? (
                  <div className="mt-2">
                    <ChangeRequestLinks projectId={projectId} cr={cr} />
                    <ChangeClaimDelays cr={cr} />
                    <ChangeRequestRevisions cr={cr} />
                    {cr.costImpact > 0 ? <ChangeRequestBudgetAllocations projectId={projectId} cr={cr} /> : null}
                    <Discussion projectId={projectId} cr={cr} />
                  </div>
                ) : null}
              </div>

              <footer className="shrink-0 px-[24px] pb-[24px] pt-[8px]">
                <ChangeRequestActions projectId={projectId} cr={cr} appearance="modal" />
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
