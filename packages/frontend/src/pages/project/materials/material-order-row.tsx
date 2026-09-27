import { MoreVertical } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Badge } from "@/components/atoms/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type {
  MaterialOrder,
  MaterialOrderStatus,
  RequestPriority,
} from "@/lib/project-types";
import { STATUS_META, nextStatus } from "./shared";

const PRIORITY_TONE: Record<RequestPriority, "danger" | "warning" | "neutral"> = {
  Critical: "danger",
  High: "warning",
  Normal: "neutral",
  Low: "neutral",
};

export function MaterialOrderRow({
  order,
  onEdit,
  onDelete,
  onAdvance,
  canRequest,
  canApprove,
}: {
  order: MaterialOrder;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (status: MaterialOrderStatus) => void;
  canRequest: boolean;
  canApprove: boolean;
}) {
  const next = nextStatus(order.status);
  // Approval-tier transitions mirror the backend guard.
  const APPROVAL = ["Approved", "Ordered", "PartiallyDelivered", "Delivered"];
  const canAdvance =
    next !== null && (APPROVAL.includes(next) ? canApprove : canRequest);

  return (
    <article className="border border-[#EBEBEB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
          <span className="font-medium text-[#004DE7]">
            Needed {formatShortDate(order.neededBy) || "—"}
          </span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">Phase: {order.phaseName ?? "Unlinked"}</span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">Activity: {order.activityName ?? "Unlinked"}</span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[#767676]">Doc: {order.documentName ?? "No receipt/spec"}</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Order actions"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#9CA3AF] outline-none transition-colors hover:bg-[#F5F5F5] hover:text-[#1E1E1E]"
              >
                <MoreVertical className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-[200px]">
            {canRequest && (
              <DropdownMenuItem onSelect={onEdit}>
                <ReactSVG src={icons2.edit} className="size-4 shrink-0" />
                Edit
              </DropdownMenuItem>
            )}
            {canAdvance && next && (
              <DropdownMenuItem onSelect={() => onAdvance(next)}>
                Move to {STATUS_META[next].label}
              </DropdownMenuItem>
            )}
            {canApprove && (
              <DropdownMenuItem tone="danger" onSelect={onDelete}>
                <ReactSVG src={icons2.delete} className="size-4 shrink-0" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#1E1E1E]">
            <span className="truncate">
              {order.quantity} {order.unit} · {order.materialName}
            </span>
            <Badge tone={PRIORITY_TONE[order.priority]} size="sm">
              {order.priority}
            </Badge>
          </p>
          <p className="mt-1 truncate text-xs text-[#767676]">{order.title}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className="whitespace-nowrap text-sm font-bold tabular-nums text-[#1E1E1E]">
            {formatCurrency(order.estimatedCost, order.currency)}
          </p>
          <Badge tone={STATUS_META[order.status].tone} size="sm">
            {STATUS_META[order.status].label}
          </Badge>
        </div>
      </div>
    </article>
  );
}
