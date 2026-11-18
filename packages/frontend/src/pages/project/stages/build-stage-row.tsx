import { useEffect, useState } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import type { Stage, StageStatus } from "@/lib/project-types";
import { cn } from "@/lib/utils";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: StageStatus }) {
  if (status === "InProgress")
    return (
      <Badge tone="info" size="md">
        In progress
      </Badge>
    );
  if (status === "Done")
    return (
      <Badge tone="success" size="md">
        Completed
      </Badge>
    );
  return (
    <Badge tone="neutral" variant="outline" size="md">
      Not Started
    </Badge>
  );
}

function StageRowMenu({
  onEdit,
  onInlineEdit,
  onDelete,
}: {
  onEdit: () => void;
  onInlineEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
            aria-label="Actions"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem onSelect={onInlineEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>Edit details</DropdownMenuItem>
        <DropdownMenuItem tone="danger" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface BuildStageRowProps {
  stage: Stage;
  canManage: boolean;
  /** Dropping the dragged stage on `target` places it at the target's position, in the target's phase. */
  onMove: (draggedStageId: string, target: Stage) => void;
  onRename: (name: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BuildStageRow({ stage, canManage, onMove, onRename, onEdit, onDelete }: BuildStageRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState(stage.name);
  const [dragOver, setDragOver] = useState(false);
  // Reordering is scoped to a building phase, so a stage outside one has no order to change.
  const canDrag = canManage && Boolean(stage.buildingPhaseId);

  useEffect(() => {
    setInlineValue(stage.name);
  }, [stage.name]);

  function commitInline() {
    const v = inlineValue.trim();
    setInlineEditing(false);
    if (!v || v === stage.name) {
      setInlineValue(stage.name);
      return;
    }
    onRename(v);
  }

  function handleDrop(e: React.DragEvent<HTMLTableRowElement>): void {
    e.preventDefault();
    setDragOver(false);
    if (!canDrag) return;
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== stage.id) onMove(draggedId, stage);
  }

  return (
    <>
      <tr
        className={cn("group hover:bg-[#FAFAFA]", dragOver && "bg-[#EEF3FF]")}
        draggable={canDrag}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", stage.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!canDrag) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <td className="px-2 py-3">
          <button
            type="button"
            aria-label="Drag handle"
            disabled={!canDrag}
            title={canDrag ? "Drag to reorder" : undefined}
            className={cn(
              "flex size-6 items-center justify-center text-[#9CA3AF]",
              canDrag
                ? "cursor-grab hover:text-[#111827] active:cursor-grabbing"
                : "cursor-default opacity-40",
            )}
          >
            <ReactSVG src={icons2.reorder} />
          </button>
        </td>
        <td className="px-3 py-3">
          {inlineEditing ? (
            <input
              autoFocus
              value={inlineValue}
              onChange={(e) => setInlineValue(e.target.value)}
              onBlur={commitInline}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitInline();
                if (e.key === "Escape") {
                  setInlineEditing(false);
                  setInlineValue(stage.name);
                }
              }}
              aria-label={`Rename ${stage.name}`}
              className="h-8 w-full border border-[#EBEBEB] bg-white px-2 text-sm text-[#111827] outline-none focus:border-[#111827]"
            />
          ) : (
            <span className="text-sm font-medium text-[#111827]">
              {stage.name}
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={stage.status} />
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
          {formatDate(stage.startDate)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[#6B7280]">
          {formatDate(stage.endDate)}
        </td>
        <td className="px-3 py-3">
          <span className="text-sm font-medium text-[#111827]">
            {stage.progressPercent}%
          </span>
        </td>
        <td className="px-2 py-3">
          {canManage ? (
            <StageRowMenu
              onEdit={onEdit}
              onInlineEdit={() => setInlineEditing(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : null}
        </td>
      </tr>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={onDelete}
        title="Delete stage"
        description="This removes the stage from the build plan. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
BuildStageRow.displayName = "BuildStageRow";
