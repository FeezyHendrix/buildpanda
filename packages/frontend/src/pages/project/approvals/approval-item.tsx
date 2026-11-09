import { MoreVertical } from "lucide-react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { MessagesIcon } from "@/components/atoms/project-nav-icons";
import { getFileTypeIcon } from "@/lib/file-type-icon";
import { cn } from "@/lib/utils";
import type { Approval, ApprovalAttachment } from "@/lib/project-types";
import { DISPLAY_STATUS_META, displayStatus } from "./shared";

/** Chips shown before "+N" stands in for the rest. */
const VISIBLE_ATTACHMENTS = 3;

function formatDue(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AttachmentChip({ attachment }: { attachment: ApprovalAttachment }) {
  const content = (
    <>
      <ReactSVG src={getFileTypeIcon(attachment.fileName)} className="shrink-0 [&_svg]:size-5" />
      <span className="truncate">{attachment.fileName}</span>
    </>
  );
  const className = "inline-flex h-9 max-w-[260px] items-center gap-2 bg-[#F5F5F5] px-3 text-caption-l! font-medium text-[#1E1E1E]";

  return attachment.url ? (
    <a href={attachment.url} target="_blank" rel="noreferrer" title={attachment.fileName} className={cn(className, "hover:bg-[#EBEBEB]")}>
      {content}
    </a>
  ) : (
    <span title={attachment.fileName} className={className}>
      {content}
    </span>
  );
}

AttachmentChip.displayName = "AttachmentChip";

interface ApprovalItemProps {
  approval: Approval;
  /** The viewer may record a decision on this one (an approver, and the requested reviewer if one was named). */
  mayDecide: boolean;
  canManage: boolean;
  approving: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** One request in the register: where it stands, what it asks, what came with it, and what the viewer can do. */
export function ApprovalItem({
  approval,
  mayDecide,
  canManage,
  approving,
  onOpen,
  onApprove,
  onEdit,
  onDelete,
}: ApprovalItemProps) {
  const display = displayStatus(approval, mayDecide);
  const meta = DISPLAY_STATUS_META[display];
  const due = formatDue(approval.dueDate);
  const attachments = approval.attachments ?? [];
  const extra = Math.max(0, (approval.attachmentCount ?? attachments.length) - Math.min(attachments.length, VISIBLE_ATTACHMENTS));
  const settled = approval.status === "Approved" || approval.status === "Rejected";

  return (
    <article className="px-6 py-6" title={approval.requestedReviewerName ? `Reviewer: ${approval.requestedReviewerName}` : undefined}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-caption-m! font-medium whitespace-nowrap", meta.className)}>
            {meta.label}
          </span>
          {approval.category ? (
            <span className="inline-flex h-6 items-center rounded-full border border-[#EBEBEB] bg-white px-2.5 text-caption-m! font-medium text-[#1E1E1E]">
              {approval.category}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-caption-m! italic text-gray-500">
          {approval.commentCount > 0 ? (
            <span className="inline-flex items-center gap-1 not-italic">
              <MessagesIcon className="size-3.5" />
              {approval.commentCount}
            </span>
          ) : null}
          {due && !settled ? <span>Due {due}</span> : null}
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Actions for ${approval.title}`}
                    className="flex size-6 items-center justify-center text-[#1E1E1E] not-italic hover:bg-[#F5F5F5]"
                  >
                    <MoreVertical className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-[140px]">
                <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem tone="danger" onSelect={onDelete}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="mt-3 block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10">
        <h3 className="text-caption-l! font-semibold text-[#1E1E1E]">{approval.title}</h3>
        {approval.description ? (
          <p className="mt-2 line-clamp-1 text-caption-l! text-[#1E1E1E]">{approval.description}</p>
        ) : null}
      </button>

      {attachments.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {attachments.slice(0, VISIBLE_ATTACHMENTS).map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} />
          ))}
          {extra > 0 ? (
            <span className="inline-flex h-9 items-center bg-[#F5F5F5] px-3 text-caption-l! font-medium text-[#1E1E1E]">+{extra}</span>
          ) : null}
        </div>
      ) : null}

      {display === "needs-me" ? (
        // Approving needs no note; rejecting or asking for changes does, so those open the decision form.
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="lg" loading={approving} onClick={onApprove} className="bg-[#00A63E] hover:bg-[#008236]">
            Approve
          </Button>
          <Button size="lg" onClick={onOpen} className="bg-[#E7000B] hover:bg-[#A30006]">
            Reject
          </Button>
          <Button size="lg" variant="outline" onClick={onOpen}>
            Request Revision
          </Button>
        </div>
      ) : display === "Resubmit" ? (
        <div className="mt-4">
          <Button size="lg" onClick={onOpen}>
            View Changes
          </Button>
        </div>
      ) : null}
    </article>
  );
}

ApprovalItem.displayName = "ApprovalItem";
