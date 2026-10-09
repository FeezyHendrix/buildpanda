import { useState } from "react";
import type { PreconBoqRow } from "@/api/precon";
import type { OperationHistoryEntry } from "@/api/precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import { newOperationId, useEditorHistory, useEditorReverse } from "@/hooks/use-precon-editor";

interface Args {
  sessionId: string;
  sheetId: string | null;
  rowById: Map<string, PreconBoqRow>;
}

/**
 * Undo/redo over SAVED edits, rebuilt from the audit trail on every read.
 * An entry with `direction: "undo"` is an edit whose reversal undoes it; a
 * `"redo"` entry is a compensation whose reversal re-applies the edit. The
 * server refuses anything unsafe with a reason, which is surfaced, not thrown.
 */
export function useOpHistory({ sessionId, sheetId, rowById }: Args) {
  // The server now folds compensation parity into `direction` (chain depth) and
  // derives touchedSheetIds from the recorded states, so the sheet-scoped
  // query and the direction field are trusted as returned.
  const history = useEditorHistory(sessionId, sheetId ?? undefined);
  const reverse = useEditorReverse(sessionId);
  const [note, setNote] = useState<string | null>(null);

  const operations = history.data?.operations ?? [];
  const undoTarget = operations.find((op) => op.eligible && op.direction === "undo") ?? null;
  const redoTarget = operations.find((op) => op.eligible && op.direction === "redo") ?? null;
  const blockedReason = undoTarget ? null : (operations.find((op) => op.direction === "undo")?.reason ?? "Nothing to undo yet");

  const run = (target: OperationHistoryEntry | null) => {
    if (!target || reverse.isPending) return;
    const expectedRows = target.rowIds.flatMap((id) => {
      const row = rowById.get(id);
      return row ? [{ id, version: row.version }] : [];
    });
    reverse.mutate(
      { eventId: target.eventId, body: { operationId: newOperationId(), expectedRows } },
      {
        onSuccess: (outcome) => setNote(outcome.reversed ? null : outcome.reason),
        onError: (error) => setNote(getApiErrorMessage(error, "Could not reverse that edit")),
      },
    );
  };

  return {
    canUndo: undoTarget !== null,
    canRedo: redoTarget !== null,
    busy: reverse.isPending,
    undoBlockedReason: blockedReason,
    note,
    undo: () => run(undoTarget),
    redo: () => run(redoTarget),
  };
}
