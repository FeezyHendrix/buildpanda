import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { TableCell, TableRow } from "@/components/atoms/table";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import {
  UpsertStageDialog,
  type UpsertStageValues,
} from "@/components/molecules/upsert-stage-dialog";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import type { Stage, StageStatus } from "@/lib/project-types";

function formatDate(iso: string | null | undefined): string {
  return formatShortDate(iso ?? null) || "—";
}

function StatusCell({ status }: { status: StageStatus }) {
  if (status === "InProgress")
    return (
      <Badge tone="info" size="sm">
        In progress
      </Badge>
    );
  if (status === "Done")
    return (
      <Badge tone="success" size="sm">
        Completed
      </Badge>
    );
  return <span className="text-sm text-gray-400">Not started</span>;
}

StatusCell.displayName = "StatusCell";

interface StageRowProps {
  stage: Stage;
  index: number;
  total: number;
  canManage: boolean;
  currency: string;
  unallocated?: number;
  /** The 409's message when this stage still has activities or a value. */
  deleteError: string | null;
  isDeleting: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onUpdate: (values: UpsertStageValues) => void;
  onDelete: (onSettled: () => void) => void;
  onDeleteDialogChange: (open: boolean) => void;
}

function StageRow({
  stage,
  index,
  total,
  canManage,
  currency,
  unallocated,
  deleteError,
  isDeleting,
  onMove,
  onUpdate,
  onDelete,
  onDeleteDialogChange,
}: StageRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function openDelete(next: boolean): void {
    setDeleteOpen(next);
    onDeleteDialogChange(next);
  }

  return (
    <>
      <TableRow className="group hover:bg-surface-alt">
        <TableCell className="px-3">
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
              className="p-0 leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="button"
              aria-label="Move down"
              disabled={index === total - 1}
              onClick={() => onMove(index, 1)}
              className="p-0 leading-none text-gray-400 hover:text-gray-900 disabled:opacity-30"
            >
              ▼
            </button>
          </div>
        </TableCell>

        <TableCell>
          <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-surface-alt text-[12px] font-medium text-ink">
            {index + 1}
          </span>
        </TableCell>

        <TableCell className="font-medium">{stage.name}</TableCell>

        <TableCell>
          <StatusCell status={stage.status} />
        </TableCell>

        <TableCell align="right" className="whitespace-nowrap tabular-nums">
          {stage.value > 0 ? formatWholeCurrency(stage.value, currency) : "—"}
        </TableCell>

        <TableCell className="whitespace-nowrap">{formatDate(stage.startDate)}</TableCell>

        <TableCell className="whitespace-nowrap">{formatDate(stage.endDate)}</TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <ProgressBar tone="success" value={stage.progressPercent} size="md" />
            <span className="w-8 text-right text-[12px] tabular-nums text-ink">
              {stage.progressPercent}%
            </span>
          </div>
        </TableCell>

        <TableCell className="px-3">
          {canManage ? (
            <RowActionsMenu onEdit={() => setEditOpen(true)} onDelete={() => openDelete(true)} />
          ) : null}
        </TableCell>
      </TableRow>

      <UpsertStageDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        currency={currency}
        unallocated={unallocated}
        initial={{
          name: stage.name,
          status: stage.status,
          startDate: stage.startDate,
          endDate: stage.endDate,
          progressPercent: stage.progressPercent,
          value: stage.value,
        }}
        onSubmit={(values) => {
          onUpdate(values);
          setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={openDelete}
        loading={isDeleting}
        onConfirm={() => onDelete(() => setDeleteOpen(false))}
        title="Delete stage"
        // The server names what still hangs off the stage (409 with counts); a
        // silent close with the stage still there is what a PM saw before (#44).
        description={
          deleteError ??
          "This removes the stage from the build plan. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

StageRow.displayName = "StageRow";

export { StageRow, type StageRowProps };
