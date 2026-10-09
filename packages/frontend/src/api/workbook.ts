// The four workbook endpoints, and the two refusals a caller must be able to
// tell apart.
//
// A 409 and a 422 mean opposite things here and the UI acts on each
// differently, so they are classified once — at the boundary — rather than by
// every call site re-reading `error.response.status`:
//
//   409 stale     someone else moved the workbook or a source figure. The
//                 draft is still good; the BASE it was built on is not.
//   422 protected the candidate would have altered a measured figure. NOTHING
//                 was saved, and resending the same document will fail again.
//
// Both keep the user's work. Neither is a reason to drop an editor's text.

import api from "./client";
import type {
  WorkbookDocument,
  WorkbookHistory,
  WorkbookReverseRequest,
  WorkbookReverseResult,
  WorkbookSaveRequest,
  WorkbookSaveResult,
} from "./workbook-types";

export * from "./workbook-types";

const base = (sessionId: string): string => `/precon/sessions/${sessionId}/workbook`;

export const workbookApi = {
  get: (sessionId: string) => api.get<WorkbookDocument>(base(sessionId)).then((r) => r.data),

  history: (sessionId: string, limit?: number) =>
    api
      .get<WorkbookHistory>(`${base(sessionId)}/history`, { params: limit ? { limit } : undefined })
      .then((r) => r.data),

  save: (sessionId: string, body: WorkbookSaveRequest) =>
    api.post<WorkbookSaveResult>(`${base(sessionId)}/operations`, body).then((r) => r.data),

  reverse: (sessionId: string, eventId: string, body: WorkbookReverseRequest) =>
    api
      .post<WorkbookReverseResult>(`${base(sessionId)}/operations/${eventId}/reverse`, body)
      .then((r) => r.data),

  /**
   * The XLSX, fetched through the API client so it carries the session.
   *
   * Deliberately not a plain `<a href>` to the export URL: the API is a
   * different origin from the app in every environment that does not proxy it,
   * and a cross-origin navigation drops the auth cookie — which answers 401
   * rather than downloading anything. This is the same pattern the programme
   * and CSV exports already use.
   */
  exportXlsx: (sessionId: string) =>
    api.get(`${base(sessionId)}/export.xlsx`, { responseType: "blob" }).then((r) => r.data as Blob),
};

export * from "./workbook-failure";
