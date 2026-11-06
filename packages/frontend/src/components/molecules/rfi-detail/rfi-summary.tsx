import { ChevronDown } from "lucide-react";
import { formatShortDate } from "@/lib/formatters";
import {
  isRfiOverdue,
  overdueLabel,
  rfiOverdueDays,
  RFI_PILL_BASE,
  RFI_PRIORITY_LABEL,
  RFI_PRIORITY_PILL,
  RFI_STATUS_META,
  RFI_STATUS_PILL,
} from "@/lib/rfi-meta";
import { cn } from "@/lib/utils";
import type { Rfi } from "@/lib/project-types";
import { InfoCard } from "./info-card";
import { RfiAuditTrail } from "./rfi-audit-trail";

export interface AssigneeChoice {
  id: string;
  name: string;
}

const VALUE_CLASS = "text-[14px] leading-[20px] text-[#1E1E1E]";

/**
 * The record itself: number and status, the subject, who raised it, when it is due,
 * who has the ball, its priority and the question. Managers can change who has the ball.
 */
export function RfiSummary({
  rfi,
  projectId,
  creatorName,
  canAssign,
  assigneeOptions,
  assigning,
  onAssign,
}: {
  rfi: Rfi;
  projectId: string;
  creatorName: string | null;
  canAssign: boolean;
  assigneeOptions: AssigneeChoice[];
  assigning: boolean;
  onAssign: (ballInCourtId: string | null) => void;
}) {
  const overdue = isRfiOverdue(rfi);

  return (
    <>
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[12px] font-medium text-[#737373]">RFI-{rfi.number}</span>
        <span className={cn(RFI_PILL_BASE, "h-[22px]", RFI_STATUS_PILL[rfi.status])}>{RFI_STATUS_META[rfi.status].label}</span>
        {overdue ? (
          <span className={cn(RFI_PILL_BASE, "h-[22px]", RFI_STATUS_PILL.Void)}>⚠ {overdueLabel(rfiOverdueDays(rfi))}</span>
        ) : null}
        {rfi.reopenedCount > 0 ? (
          <span className={cn(RFI_PILL_BASE, "h-[22px]", RFI_STATUS_PILL.InReview)}>↻ Reopened ×{rfi.reopenedCount}</span>
        ) : null}
      </div>

      <h2 className="mt-[6px] text-[20px] font-semibold leading-[28px] text-[#111111]">{rfi.subject}</h2>

      <div className="mt-[24px] grid grid-cols-2 gap-[12px]">
        <InfoCard label="Created by" className="h-[69px] gap-[10px]">
          <p className={VALUE_CLASS}>{creatorName ?? "—"}</p>
        </InfoCard>
        <InfoCard label="Due Date" className="h-[69px] gap-[10px]">
          <p className={cn(VALUE_CLASS, overdue && "font-medium text-[#E7000B]")}>
            {rfi.dueDate ? formatShortDate(rfi.dueDate) : "No due date"}
          </p>
        </InfoCard>
        <InfoCard label="Assigned to" className="h-[73px] gap-[8px]">
          {canAssign ? (
            <div className="relative">
              <select
                aria-label="Assigned to"
                value={rfi.ballInCourtId ?? ""}
                disabled={assigning}
                onChange={(e) => onAssign(e.target.value || null)}
                className={cn(VALUE_CLASS, "w-full cursor-pointer appearance-none bg-transparent pr-[20px] outline-none focus-visible:underline")}
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-[14px] -translate-y-1/2 text-[#737373]" strokeWidth={1.5} />
            </div>
          ) : (
            <p className={VALUE_CLASS}>{rfi.ballInCourtName ?? "Unassigned"}</p>
          )}
        </InfoCard>
        <InfoCard label="Priority" className="h-[73px] gap-[7px]">
          <span className={cn(RFI_PILL_BASE, "h-[25px] self-start", RFI_PRIORITY_PILL[rfi.priority])}>
            {RFI_PRIORITY_LABEL[rfi.priority]}
          </span>
        </InfoCard>
      </div>

      <section aria-label="Question" className="mt-[12px] border border-[#EEEEEE] px-[16px] pb-[16px] pt-[15px]">
        <h3 className="text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">Question</h3>
        {rfi.questionHtml ? (
          <div
            className="prose prose-sm mt-[12px] max-w-none text-[14px] leading-[20px] text-[#1E1E1E] prose-p:my-0 [&_img]:max-h-64 [&_img]:rounded"
            dangerouslySetInnerHTML={{ __html: rfi.questionHtml }}
          />
        ) : (
          <p className="mt-[12px] whitespace-pre-wrap text-[14px] leading-[20px] text-[#1E1E1E]">{rfi.question}</p>
        )}
      </section>

      <RfiAuditTrail projectId={projectId} rfiId={rfi.id} />
    </>
  );
}

RfiSummary.displayName = "RfiSummary";
