import { useState } from "react";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import type { PreconTool } from "@/lib/precon-meta";

export type PendingSwitch = { kind: "tool"; tool: PreconTool } | { kind: "sheet"; sheetId: string };

interface Args {
  /** Half-drawn work a switch would silently destroy. */
  dirty: boolean;
  activeSheetId: string | null;
  applyTool: (tool: PreconTool) => void;
  applySheet: (sheetId: string) => void;
}

/**
 * Keep editing / Discard protection for a dirty tool or sheet switch: the
 * switch is held as `pending` until the user confirms it, and a clean switch
 * passes straight through.
 */
export function useDiscardGuard({ dirty, activeSheetId, applyTool, applySheet }: Args) {
  const [pending, setPending] = useState<PendingSwitch | null>(null);

  const requestTool = (tool: PreconTool) => {
    if (dirty) setPending({ kind: "tool", tool });
    else applyTool(tool);
  };
  const requestSheet = (sheetId: string) => {
    if (dirty && sheetId !== activeSheetId) setPending({ kind: "sheet", sheetId });
    else applySheet(sheetId);
  };
  const confirm = () => {
    if (!pending) return;
    setPending(null);
    if (pending.kind === "tool") applyTool(pending.tool);
    else applySheet(pending.sheetId);
  };
  const dismiss = () => setPending(null);

  return { pending, requestTool, requestSheet, confirm, dismiss };
}

interface DialogProps {
  pending: PendingSwitch | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function DiscardDraftDialog({ pending, onConfirm, onDismiss }: DialogProps) {
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      onConfirm={onConfirm}
      title="Discard the shape being drawn?"
      description={pending?.kind === "sheet" ? "Changing sheet drops the unfinished measurement. Saved measurements are not affected." : "Changing tool drops the unfinished measurement. Saved measurements are not affected."}
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      variant="danger"
    />
  );
}
DiscardDraftDialog.displayName = "DiscardDraftDialog";
