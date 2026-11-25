import { useMemo } from "react";
import { Link } from "react-router-dom";
import { RowActionIcon } from "@/components/molecules/row-action-icon";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";
import type { ChangeRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { STATUS_PILL, impactLine, initialsOf, typeLabel } from "./change-order-model";

const CHIP = "inline-flex h-[24px] items-center rounded-full border border-[#EEEEEE] bg-white px-[8px] text-caption-m font-medium text-[#1E1E1E]";

interface ChangeOrderCardProps {
  cr: ChangeRequest;
  projectId: string;
  canManage: boolean;
  onView: (cr: ChangeRequest) => void;
  onAssign: (cr: ChangeRequest) => void;
  onEdit: (cr: ChangeRequest) => void;
  onDelete: (cr: ChangeRequest) => void;
}

/** Who has it: their initials in a dark disc, or a plain "Unassigned". */
function Assignee({ name }: { name: string | null }) {
  if (!name) return <span className="text-caption-m text-[#737373]">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-[8px]">
      <span
        aria-hidden
        className="flex size-[24px] items-center justify-center rounded-full bg-[#1E1E1E] text-[10px] font-semibold leading-none text-white"
      >
        {initialsOf(name)}
      </span>
      <span className="truncate text-caption-m text-[#737373]">{name}</span>
    </span>
  );
}

Assignee.displayName = "Assignee";

/**
 * One change order on the board. The status is read here and moved only by the
 * actions in the sheet (submit, approve, reject, execute), never by dragging.
 */
export function ChangeOrderCard({ cr, projectId, canManage, onView, onAssign, onEdit, onDelete }: ChangeOrderCardProps) {
  const actions = useMemo<RowActionItem[]>(
    () => [
      ...(canManage ? [{ label: "Assign", icon: <RowActionIcon name="assign" />, onSelect: () => onAssign(cr) }] : []),
      { label: "View Order", icon: <RowActionIcon name="view" />, onSelect: () => onView(cr) },
      ...(canManage && cr.status !== "Executed" ? [{ label: "Edit Order", icon: <RowActionIcon name="edit" />, onSelect: () => onEdit(cr) }] : []),
      ...(canManage ? [{ label: "Delete Order", icon: <RowActionIcon name="delete" />, tone: "danger" as const, onSelect: () => onDelete(cr) }] : []),
    ],
    [cr, canManage, onAssign, onView, onEdit, onDelete],
  );

  return (
    <article className="relative bg-white px-[16px] pb-[11px] pt-[11px]">
      <button
        type="button"
        onClick={() => onView(cr)}
        aria-label={`View ${cr.title}`}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#004DE7]/25"
      />
      <div className="pointer-events-none relative flex items-start justify-between">
        <span className={cn("inline-flex h-[24px] items-center rounded-full border px-[10px] text-caption-m font-medium", STATUS_PILL[cr.status])}>
          {cr.status}
        </span>
        <div className="pointer-events-auto -mr-[4px] -mt-[4px]">
          <RowActionsMenu ariaLabel={`Actions for ${cr.title}`} items={actions} appearance="house" />
        </div>
      </div>

      <div className="pointer-events-none relative mt-[14px]">
        <p className="truncate text-caption-l font-semibold leading-[18px] text-[#1E1E1E]">{cr.title}</p>
        <p className="truncate text-caption-l leading-[16px] tabular-nums text-[#737373]">{impactLine(cr)}</p>
      </div>

      <div className="relative mt-[15px] flex flex-wrap gap-[4px]">
        <span className={cn(CHIP, "pointer-events-none")}>{typeLabel(cr.type)}</span>
        {cr.contractId ? (
          <Link
            to={`/project/${projectId}/${CONTRACTS_PHASES_PATH}?drawer=${encodeURIComponent(cr.contractId)}`}
            className={cn(CHIP, "outline-none hover:bg-[#F6F6F6] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25")}
          >
            Contract
          </Link>
        ) : null}
      </div>

      <div className="pointer-events-none relative mt-[16px] min-h-[24px]">
        <Assignee name={cr.assigneeName} />
      </div>
    </article>
  );
}

ChangeOrderCard.displayName = "ChangeOrderCard";
