// Facade for the take-off API client. The DTOs live in `precon-types.ts` and
// `precon-row-types.ts`; the row and geometry calls live in `precon-rows.ts`
// and `precon-geometry.ts`. Everything is re-exported here, so every existing
// `from "@/api/precon"` import keeps resolving.
import api from "./client";
import { preconRowsApi } from "./precon-rows";
import { preconGeometryApi } from "./precon-geometry";
import type {
  CreateProgrammeTaskInput,
  PreconProgramme,
  PreconProgrammeTaskBase,
  PreconSession,
  PreconSheet,
  PreconSnapshot,
  PreconSummarySettings,
  LayerMap,
  TakeoffMode,
  TakeoffScope,
  UpdateProgrammeTaskInput,
  UpdateSheetInput,
  UpdateStructureInput,
  SheetViewport,
} from "./precon-types";
import type {
  ApplyPins,
  ApplyPreview,
  Assembly,
  CreateAssemblyMeasurementBody,
  CreateAssemblyMeasurementResult,
  PreconBoqRow,
  RoomAtResult,
  SymbolMatchesResult,
  UpsertAssemblyInput,
} from "./precon-row-types";

export * from "./precon-row-types";
export * from "./precon-types";
export { preconRowsApi } from "./precon-rows";
export { preconGeometryApi } from "./precon-geometry";

export const preconApi = {
  listSessions: (proposalId?: string) =>
    api
      .get<PreconSession[]>(`/precon/sessions`, { params: proposalId ? { proposalId } : undefined })
      .then((r) => r.data),

  createSessionFromPlan: (proposalId: string, planId: string, scope: TakeoffScope) =>
    api.post<PreconSession>(`/precon/sessions/from-plan`, { proposalId, planId, scope }).then((r) => r.data),

  retrySession: (sessionId: string) =>
    api.post<PreconSession>(`/precon/sessions/${sessionId}/retry`).then((r) => r.data),

  updateSheet: (sheetId: string, input: UpdateSheetInput) =>
    api.patch<PreconSheet>(`/precon/sheets/${sheetId}`, input).then((r) => r.data),

  remeasureSheet: (sheetId: string) =>
    api.post<{ status: string }>(`/precon/sheets/${sheetId}/remeasure`).then((r) => r.data),

  updateStructure: (sessionId: string, input: UpdateStructureInput) =>
    api.patch<PreconSession>(`/precon/sessions/${sessionId}/structure`, input).then((r) => r.data),

  /** Stores the corrected layer map and re-measures the DWG with it (202: the run is queued). */
  updateLayerMap: (sessionId: string, layerMap: LayerMap) =>
    api.patch<PreconSession>(`/precon/sessions/${sessionId}/layer-map`, { layerMap }).then((r) => r.data),

  redraftBill: (sessionId: string) =>
    api.post<{ status: string }>(`/precon/sessions/${sessionId}/redraft-bill`).then((r) => r.data),

  createSession: (files: File[], title?: string) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return api
      .post<PreconSession>(`/precon/sessions`, form, {
        params: title ? { title } : undefined,
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  createBlankSession: (title: string, proposalId?: string) =>
    api.post<PreconSession>(`/precon/sessions/blank`, { title, proposalId }).then((r) => r.data),

  snapshot: (sessionId: string) => api.get<PreconSnapshot>(`/precon/sessions/${sessionId}`).then((r) => r.data),

  ...preconRowsApi,
  ...preconGeometryApi,

  updateSettings: (sessionId: string, patch: Partial<PreconSummarySettings>) =>
    api.patch<PreconSummarySettings>(`/precon/sessions/${sessionId}/settings`, patch).then((r) => r.data),

  snapIndex: (sheetId: string) =>
    api.get<{ points: number[][] }>(`/precon/sheets/${sheetId}/snap`).then((r) => r.data.points),

  sheetFileUrl: (sheetId: string) => `${api.defaults.baseURL ?? ""}/precon/sheets/${sheetId}/file`,
  sheetSvgUrl: (sheetId: string) => `${api.defaults.baseURL ?? ""}/precon/sheets/${sheetId}/svg`,

  exportUrl: (sessionId: string) => `${api.defaults.baseURL ?? ""}/precon/sessions/${sessionId}/export.xlsx`,

  generateProgramme: (sessionId: string) =>
    api.post<{ status: "queued" }>(`/precon/sessions/${sessionId}/programme`).then((r) => r.data),

  programme: (sessionId: string) =>
    api.get<PreconProgramme>(`/precon/sessions/${sessionId}/programme`).then((r) => r.data),

  setProgrammeStart: (sessionId: string, startDate: string) =>
    api.patch<PreconProgramme>(`/precon/sessions/${sessionId}/programme/start`, { startDate }).then((r) => r.data),

  exportProgrammeXml: (sessionId: string) =>
    api
      .get(`/precon/sessions/${sessionId}/programme/export.xml`, { responseType: "blob" })
      .then((r) => r.data as Blob),

  updateProgrammeTask: (taskId: string, input: UpdateProgrammeTaskInput) =>
    api.patch<PreconProgrammeTaskBase>(`/precon/programme-tasks/${taskId}`, input).then((r) => r.data),

  createProgrammeTask: (sessionId: string, input: CreateProgrammeTaskInput) =>
    api.post<PreconProgrammeTaskBase>(`/precon/sessions/${sessionId}/programme/tasks`, input).then((r) => r.data),

  deleteProgrammeTask: (taskId: string) =>
    api.delete<{ ok: true }>(`/precon/programme-tasks/${taskId}`).then((r) => r.data),

  verifyProgrammeTask: (taskId: string, version: number) =>
    api.post<PreconProgrammeTaskBase>(`/precon/programme-tasks/${taskId}/verify`, { version }).then((r) => r.data),

  rejectProgrammeTask: (taskId: string, version: number) =>
    api.post<PreconProgrammeTaskBase>(`/precon/programme-tasks/${taskId}/reject`, { version }).then((r) => r.data),

  applyToProposal: (sessionId: string) =>
    api
      .post<{ proposalId: string; itemCount: number }>(`/precon/sessions/${sessionId}/apply-to-proposal`)
      .then((r) => r.data),
};

export const preconApplyApi = {
  /** Writes nothing; returns the diff plus the pin material (fingerprints, expectedRows, review). */
  previewApply: (sessionId: string, estimateId: string) =>
    api
      .post<ApplyPreview>(`/precon/sessions/${sessionId}/apply-to-estimate`, { estimateId, mode: "preview" })
      .then((r) => r.data),

  /**
   * Applies EXACTLY the previewed state: all four pins are required and must
   * echo the stored preview (400 when any is missing, 409 on any drift —
   * nothing is written in either case).
   */
  applyPinned: (sessionId: string, estimateId: string, pins: ApplyPins) =>
    api
      .post<ApplyPreview>(`/precon/sessions/${sessionId}/apply-to-estimate`, { estimateId, mode: "apply", ...pins })
      .then((r) => r.data),
};

// ---- WS-M1C · manual take-off entry points and CSV export ----

export const preconManualApi = {
  /**
   * Same from-plan endpoint as the AI take-off; `mode: "manual"` makes a
   * session of kind manual whose sheets render with no measured rows. PDF and
   * DWG both go here — the backend decides by file extension.
   */
  createSessionFromPlan: (proposalId: string, planId: string, scope: TakeoffScope, mode: TakeoffMode) =>
    api.post<PreconSession>(`/precon/sessions/from-plan`, { proposalId, planId, scope, mode }).then((r) => r.data),

  /** One row per priced line and note; the bill as a spreadsheet-ready file. */
  exportCsv: (sessionId: string) =>
    api.get(`/precon/sessions/${sessionId}/export.csv`, { responseType: "blob" }).then((r) => r.data as Blob),
};

// ---- WS-M2B · viewer tools: typical, viewports, room fill, find symbol ----

export const preconViewerApi = {
  /** The enclosed space around a point, or 404 "No enclosed space here" / 422 on a picture. */
  roomAt: (sheetId: string, pt: { x: number; y: number }) =>
    api.post<RoomAtResult>(`/precon/sheets/${sheetId}/room-at`, pt).then((r) => r.data),

  /** Every match on the sheet of the symbol inside the rect ([x1, y1, x2, y2] in sheet points). */
  symbolMatches: (sheetId: string, rect: [number, number, number, number]) =>
    api.post<SymbolMatchesResult>(`/precon/sheets/${sheetId}/symbol-matches`, { rect }).then((r) => r.data),

  /** Same line on N floors or areas; the backend recomputes qty and the basis. */
  setTypical: (rowId: string, input: { version: number; typical: number }) =>
    api.patch<PreconBoqRow>(`/precon/rows/${rowId}`, { version: input.version, changes: { typical: input.typical } }).then((r) => r.data),

  updateViewports: (sheetId: string, viewports: SheetViewport[]) =>
    api.patch<PreconSheet>(`/precon/sheets/${sheetId}`, { viewports }).then((r) => r.data),
};

export const preconAssembliesApi = {
  list: () => api.get<Assembly[]>("/precon/assemblies").then((r) => r.data),
  create: (body: UpsertAssemblyInput) => api.post<Assembly>("/precon/assemblies", body).then((r) => r.data),
  update: (assemblyId: string, body: Partial<UpsertAssemblyInput>) =>
    api.patch<Assembly>(`/precon/assemblies/${assemblyId}`, body).then((r) => r.data),
  remove: (assemblyId: string) => api.delete(`/precon/assemblies/${assemblyId}`).then((r) => r.data),

  /** One drawn shape becomes one geometry and one row per assembly item. */
  createMeasurement: (sessionId: string, body: CreateAssemblyMeasurementBody) =>
    api.post<CreateAssemblyMeasurementResult>(`/precon/sessions/${sessionId}/measurements/assembly`, body).then((r) => r.data),
};

export const preconPresenceApi = {
  /** Tell the others which row this user is on; null clears it. The hub republishes `precon.presence`. */
  focus: (sessionId: string, rowId: string | null) =>
    api.post<void>(`/precon/sessions/${sessionId}/focus`, { rowId }).then((r) => r.data),
};
