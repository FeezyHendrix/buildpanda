import { useState } from "react";
import type { PreconBoqRow, PreconGeometry } from "@/api/precon";
import { editorApi, type EditorCommand, type VersionedRef } from "@/api/precon-editor";
import { getApiErrorMessage } from "@/lib/api-error";
import { useQueryClient } from "@tanstack/react-query";
import { preconKeys } from "@/hooks/query-keys";
import { newOperationId } from "@/hooks/use-precon-editor";

interface Args {
  sessionId: string;
  rowById: Map<string, PreconBoqRow>;
}

/**
 * Executes a batch as ONE `{kind:"batch"}` envelope operation pinned to every
 * selected line's version: one transaction, one receipt, one undo. One stale
 * member means NONE commit — the server rolls the whole list back and the
 * refusal is surfaced verbatim. A single command goes as itself (same receipt
 * semantics, cleaner history label).
 */
export function useBatchOps({ sessionId, rowById }: Args) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const expectedRowsFor = (geometries: PreconGeometry[]): VersionedRef[] =>
    [...new Set(geometries.map((g) => g.rowId))].flatMap((rowId) => {
      const row = rowById.get(rowId);
      return row ? [{ id: row.id, version: row.version }] : [];
    });

  const run = async (commands: EditorCommand[], expectedRows: VersionedRef[], doneMessage: string) => {
    if (commands.length === 0) return 0;
    setBusy(true);
    setNote(null);
    const command: EditorCommand = commands.length === 1 ? commands[0]! : { kind: "batch", commands: commands as never };
    try {
      await editorApi.operate(sessionId, { operationId: newOperationId(), expectedRows, command });
      setNote(doneMessage);
      return commands.length;
    } catch (error) {
      setNote(`${getApiErrorMessage(error, "The batch was refused")} — nothing committed; every step rolled back together.`);
      return 0;
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
    }
  };

  return { busy, note, clearNote: () => setNote(null), run, expectedRowsFor };
}
