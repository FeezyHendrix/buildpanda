import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { editorApi } from "@/api/precon-editor";
import type {
  CalibrationPreviewBody,
  EditorOperationRequest,
  EditorReverseBody,
} from "@/api/precon-editor";
import { editorKeys, preconKeys, preconMarkupKeys } from "@/hooks/query-keys";

/**
 * The id that makes a retried edit idempotent. The caller mints it *before*
 * sending, and reuses it on every retry of the same gesture: the server
 * records the act once, and the audit entry stays addressable by a later undo.
 */
export function newOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Send one editor command.
 *
 * A committed edit restates lines the canvas may not have drawn, so the
 * session snapshot is refetched rather than patched from the receipt; the
 * history gains a new head at the same time.
 *
 * There is deliberately no `onError` here: a refused write leaves the user's
 * unsaved shape exactly as they drew it, and only the component that owns that
 * draft may decide whether to keep, roll back or re-send it.
 */
export function useEditorOperation(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EditorOperationRequest) => editorApi.operate(sessionId, body),
    // History keys nest under the snapshot key, so one invalidation covers both.
    // Markup commands (edit/delete/restore/edit-comment) also travel this
    // envelope now, so the markup list must drop its cached versions too or a
    // follow-up delete would carry a stale version and be refused (409).
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      void qc.invalidateQueries({ queryKey: preconMarkupKeys.session(sessionId) });
    },
  });
}

/**
 * Undo or redo a committed edit. The server compensates rather than rewinds,
 * so a refusal (`reversed: false`) carries a reason and is not an error: the
 * caller shows it and leaves the bill as it stands.
 */
export function useEditorReverse(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: EditorReverseBody }) =>
      editorApi.reverse(sessionId, eventId, body),
    // History keys nest under the snapshot key, so one invalidation covers both.
    // Undo/redo can resurrect or re-delete markups, so their list refetches too.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: preconKeys.snapshot(sessionId) });
      void qc.invalidateQueries({ queryKey: preconMarkupKeys.session(sessionId) });
    },
  });
}

/** The reversible edits on a sheet, newest first, as the undo stack reads them. */
export function useEditorHistory(sessionId: string, sheetId?: string) {
  return useQuery({
    queryKey: editorKeys.history(sessionId, sheetId),
    queryFn: () => editorApi.history(sessionId, sheetId),
    enabled: Boolean(sessionId),
    staleTime: 0,
  });
}

/**
 * What a proposed scale would do to the bill. It writes nothing, so it is a
 * mutation only in the sense that the QS asks for it: the answer is a diff to
 * confirm before the calibration commits.
 */
export function useCalibrationPreview() {
  return useMutation({
    mutationFn: ({ sheetId, body }: { sheetId: string; body: CalibrationPreviewBody }) =>
      editorApi.previewCalibration(sheetId, body),
  });
}
