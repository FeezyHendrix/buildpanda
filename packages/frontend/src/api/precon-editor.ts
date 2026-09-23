// The take-off editor's wire seam: the canonical operation envelope.
//
// The backend accepts every editor write at ONE route —
// `POST /precon/sessions/:sessionId/editor-operations` — which locks the
// session, checks the pinned versions, measures, audits and answers with the
// receipt naming the audit event an undo later addresses. History, one
// receipt, and reverse live beside it on the same path.
import api from "./client";
import type {
  CalibrationPreview,
  CalibrationPreviewBody,
  ViewportPreview,
  ViewportPreviewBody,
  EditorOperationRequest,
  EditorReverseBody,
  OperationHistory,
  OperationReceipt,
  ReverseOperationOutcome,
} from "./precon-editor-types";

export * from "./precon-editor-types";

export const editorApi = {
  /** Send one editor command; the receipt names the real audit event and every version it moved. */
  operate: (sessionId: string, body: EditorOperationRequest): Promise<OperationReceipt> =>
    api
      .post<OperationReceipt>(`/precon/sessions/${sessionId}/editor-operations`, body)
      .then((r) => r.data),

  /**
   * The reversible edits on a session, optionally scoped to one sheet.
   * Entries with `direction: "undo"` are edits; `direction: "redo"` are
   * compensations whose reversal re-applies the edit they withdrew.
   */
  history: (sessionId: string, sheetId?: string, limit?: number): Promise<OperationHistory> =>
    api
      .get<OperationHistory>(`/precon/sessions/${sessionId}/editor-operations`, {
        params: { ...(sheetId ? { sheetId } : {}), ...(limit ? { limit } : {}) },
      })
      .then((r) => r.data),

  /**
   * Undo or redo a committed edit. The server compensates rather than rewinds:
   * it records a second attributed act, and refuses — with a reason, not an
   * error — anything it cannot safely reverse.
   */
  reverse: (sessionId: string, eventId: string, body: EditorReverseBody): Promise<ReverseOperationOutcome> =>
    api
      .post<ReverseOperationOutcome>(`/precon/sessions/${sessionId}/editor-operations/${eventId}/reverse`, body)
      .then((r) => r.data),

  /** Before and after for every line on the drawing, so a scale is committed having been seen. Writes nothing. */
  previewCalibration: (sheetId: string, body: CalibrationPreviewBody): Promise<CalibrationPreview> =>
    api.post<CalibrationPreview>(`/precon/sheets/${sheetId}/calibration-preview`, body).then((r) => r.data),

  /** What the proposed region set would restate or orphan. Writes nothing. */
  previewViewports: (sheetId: string, body: ViewportPreviewBody): Promise<ViewportPreview> =>
    api.post<ViewportPreview>(`/precon/sheets/${sheetId}/viewport-preview`, body).then((r) => r.data),
};
