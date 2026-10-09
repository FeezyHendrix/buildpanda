import { useCallback, useMemo } from "react";
import { useReverseWorkbook } from "@/hooks/use-workbook";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { WorkbookDocument, WorkbookHistoryEntry } from "@/api/workbook-types";

/**
 * Undo that survives a reload, because the server does it.
 *
 * Distinct from the grid's own Ctrl-Z, which reaches only unsaved local work.
 * A committed edit is reversed as a COMPENSATING SAVE: the version goes up,
 * the original entry stays in the audit trail, and the current measured
 * quantities are left alone — an undo must never restore a figure that came
 * off a drawing, only the user's own rate, description and cells.
 */
export interface SavedUndo {
  undoTarget: WorkbookHistoryEntry | null;
  redoTarget: WorkbookHistoryEntry | null;
  busy: boolean;
  run: (entry: WorkbookHistoryEntry) => void;
}

export type OnReversed = (document: WorkbookDocument) => void;

const newestFirst = (a: WorkbookHistoryEntry, b: WorkbookHistoryEntry): number =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

export function useSavedUndo(
  sessionId: string,
  document: WorkbookDocument | undefined,
  onReversed: OnReversed,
): SavedUndo {
  const reverse = useReverseWorkbook(sessionId);
  const history = document?.history ?? [];

  const undoTarget = useMemo(
    () => [...history].sort(newestFirst).find((entry) => entry.eligible && entry.action === "workbook_edited") ?? null,
    [history],
  );

  const redoTarget = useMemo(
    () => [...history].sort(newestFirst).find((entry) => entry.eligible && entry.action === "workbook_reversed") ?? null,
    [history],
  );

  const run = useCallback(
    (entry: WorkbookHistoryEntry) => {
      if (!document) return;
      reverse.mutate(
        {
          eventId: entry.eventId,
          expectedVersion: document.version,
          expectedSourceFingerprint: document.sourceFingerprint,
        },
        {
          onSuccess: (result) => {
            // A refusal is not a failure: it is the server saying a person has
            // to decide, and it carries the reason they need to decide with.
            if (!result.reversed) {
              toast(result.reason, "info");
              return;
            }
            onReversed(result.document);
          },
          onError: (error) => toast(getApiErrorMessage(error, "That change could not be reversed."), "error"),
        },
      );
    },
    [document, reverse, onReversed],
  );

  return { undoTarget, redoTarget, busy: reverse.isPending, run };
}
