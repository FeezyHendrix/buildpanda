import { MessageSquare } from "lucide-react";
import {
  isRfiOverdue,
  overdueLabel,
  rfiOverdueDays,
  RFI_PILL_BASE as PILL,
  RFI_PRIORITY_PILL as PRIORITY_PILL,
  RFI_STATUS_META,
  RFI_STATUS_PILL as STATUS_PILL,
} from "@/lib/rfi-meta";
import { cn } from "@/lib/utils";
import type { Rfi } from "@/lib/project-types";
import { PRIORITY_LABEL, formatDueDate } from "./shared";

interface RfiRowProps {
  rfi: Rfi;
  onOpen: (id: string) => void;
}

/** One RFI in the register: number, status, priority, what it asks, how many have answered. */
function RfiRow({ rfi, onOpen }: RfiRowProps) {
  const overdue = isRfiOverdue(rfi);
  const days = rfiOverdueDays(rfi);

  return (
    // A row that opens a drawer is a button, not a div (finding F41).
    <button
      type="button"
      onClick={() => onOpen(rfi.id)}
      className="block w-full border-b border-[#EEEEEE] px-[24px] pb-[16px] pt-[15px] text-left outline-none transition-colors last:border-b-0 hover:bg-[#FAFAFA] focus-visible:bg-[#FAFAFA] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="mr-[2px] text-[12px] font-medium text-[#737373]">RFI - {rfi.number}</span>
          <span className={cn(PILL, STATUS_PILL[rfi.status])}>{RFI_STATUS_META[rfi.status].label}</span>
          <span className={cn(PILL, PRIORITY_PILL[rfi.priority])}>{PRIORITY_LABEL[rfi.priority]}</span>
          {overdue ? <span className={cn(PILL, STATUS_PILL.Void)}>⚠ {overdueLabel(days)}</span> : null}
          {rfi.changeRequestId ? <span className={cn(PILL, "border-transparent bg-[#F6EEFD] text-[#5D5FEF]")}>Change event</span> : null}
        </div>
        {rfi.dueDate ? (
          <span className={cn("shrink-0 pt-[3px] text-[12px] italic leading-[16px]", overdue ? "font-medium text-[#E7000B]" : "text-[#737373]")}>
            Due {formatDueDate(rfi.dueDate)}
          </span>
        ) : null}
      </div>

      <p className="mt-[11px] truncate text-[14px] font-semibold leading-[20px] text-[#1E1E1E]">{rfi.subject}</p>
      <p className="mt-[5px] truncate text-[14px] leading-[20px] text-[#404040]">{rfi.question}</p>

      <div className="mt-[12px] flex flex-wrap items-center gap-[12px]">
        <span className="inline-flex h-[32px] items-center gap-[6px] border border-[#EEEEEE] bg-[#F5F5F5] px-[10px] text-[12px] text-[#1E1E1E]">
          <MessageSquare className="size-[14px] shrink-0 fill-[#1E1E1E]" strokeWidth={1.5} />
          Responses ({rfi.commentCount})
        </span>
        {rfi.ballInCourtName ? <span className="text-[12px] text-[#737373]">With {rfi.ballInCourtName}</span> : null}
      </div>
    </button>
  );
}

RfiRow.displayName = "RfiRow";

export { RfiRow, type RfiRowProps };
