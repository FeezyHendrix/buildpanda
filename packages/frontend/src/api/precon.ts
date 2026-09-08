import api from "./client";

export const PRECON_ROW_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
export type PreconRowStatus = (typeof PRECON_ROW_STATUSES)[number];

export const PRECON_GEOMETRY_KINDS = ["area", "linear", "count", "deduction"] as const;
export type PreconGeometryKind = (typeof PRECON_GEOMETRY_KINDS)[number];

export const STRUCTURE_CLASSES = ["building", "road", "bridge", "airport", "infrastructure", "unknown"] as const;
export type StructureClass = (typeof STRUCTURE_CLASSES)[number];

export const STRUCTURAL_SYSTEMS = ["load-bearing-masonry", "reinforced-concrete-frame", "steel-frame", "composite", "unknown"] as const;
export type StructuralSystem = (typeof STRUCTURAL_SYSTEMS)[number];

export const FOUNDATION_TYPES = ["strip", "raft", "pad", "pile", "unknown"] as const;
export type FoundationType = (typeof FOUNDATION_TYPES)[number];

export interface StructureContext {
  structureClass: StructureClass;
  buildingType: string | null;
  storeys: number | null;
  structuralSystem: StructuralSystem;
  foundationType: FoundationType;
  confidence: "high" | "low";
  signals: string[];
}

export type PreconSessionStatus = "uploading" | "generating" | "reviewing" | "output" | "failed";

export const PRECON_PHASES = ["reading", "structure", "schedules", "building", "pricing", "draft"] as const;
export type PreconPhase = (typeof PRECON_PHASES)[number];

export interface PreconProgressEntry {
  at: string;
  phase: PreconPhase;
  message: string;
}

export const TAKEOFF_SCOPE_KINDS = ["full", "sections", "areas"] as const;
export type TakeoffScopeKind = (typeof TAKEOFF_SCOPE_KINDS)[number];

export interface TakeoffScope {
  kind: TakeoffScopeKind;
  elements: string[];
}
export type PreconSheetKind = "floor-plan" | "elevation" | "section" | "detail" | "schedule" | "unknown";

export const PRECON_ROW_TYPES = ["heading", "work_section", "spec_note", "item", "provisional_sum"] as const;
export type PreconRowType = (typeof PRECON_ROW_TYPES)[number];

export const PRECON_PRICED_ROW_TYPES: readonly PreconRowType[] = ["item", "provisional_sum"];

export interface PreconSession {
  id: string;
  orgId: string;
  projectId: string | null;
  proposalId: string | null;
  status: PreconSessionStatus;
  title: string;
  error: string | null;
  phase: PreconPhase | null;
  progressLog: PreconProgressEntry[];
  scope: TakeoffScope;
  structureContext: StructureContext | null;
  createdBy: string | null;
  createdAt: string;
  /** The drawing revision this take-off measured, once the session records it. */
  planId?: string | null;
}

export interface PreconSheet {
  id: string;
  sessionId: string;
  fileName: string;
  pageNumber: number;
  code: string | null;
  title: string | null;
  kind: PreconSheetKind;
  status: "pending" | "measured" | "unmeasurable";
  scaleMmPerPt: number | null;
  scaleConfidence: number | null;
  dimUnit: "mm" | "cm" | "m" | null;
  error: string | null;
}

export interface PreconDeduction {
  label: string;
  qty: number;
  geometryId: string | null;
}

export interface PreconBoqRow {
  id: string;
  billId: string;
  sort: number;
  rowType: PreconRowType;
  elementGroup: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qtyGross: number | null;
  deductions: PreconDeduction[];
  qty: number | null;
  rate: number | null;
  amount: number | null;
  rateSource: string | null;
  confidence: "high" | "low" | null;
  status: PreconRowStatus | null;
  version: number;
  measurementBasis: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface PreconGeometry {
  id: string;
  rowId: string;
  sheetId: string;
  kind: PreconGeometryKind;
  vertices: number[][];
  source: "ai" | "manual";
  quantity: number | null;
  unit: string | null;
}

export interface PreconBill {
  id: string;
  title: string;
  sort: number;
}

export interface PreconSummarySettings {
  prelimsPct: number;
  contingencyPct: number;
  vatPct: number;
}

export interface PreconSummary {
  measuredTotal: number;
  prelims: number;
  constructionSum: number;
  contingency: number;
  subTotal: number;
  vat: number;
  grandTotal: number;
}

export interface PreconSnapshot {
  session: PreconSession;
  sheets: PreconSheet[];
  bills: PreconBill[];
  rows: PreconBoqRow[];
  geometries: PreconGeometry[];
  settings: PreconSummarySettings;
  summary: PreconSummary;
  progress: { total: number; verified: number };
}

export interface UpdateRowInput {
  version: number;
  changes: { description?: string; qty?: number; rate?: number; unit?: string };
}

export interface CreateRowInput {
  rowType?: PreconRowType;
  description: string;
  elementGroup?: string;
  code?: string;
  unit?: string;
  qty?: number;
  rate?: number;
}

export const PROGRAMME_DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export type ProgrammeDependencyType = (typeof PROGRAMME_DEPENDENCY_TYPES)[number];

export interface ProgrammeDependency {
  taskId: string;
  type: ProgrammeDependencyType;
  lagDays: number;
}

/** As stored: durations and links, with no calendar attached — what the task mutations answer with. */
export interface PreconProgrammeTaskBase {
  id: string;
  sessionId: string;
  sort: number;
  name: string;
  elementGroup: string | null;
  wbsCode: string | null;
  outlineLevel: number;
  parentTaskId: string | null;
  durationDays: number;
  predecessors: ProgrammeDependency[];
  isMilestone: boolean;
  basis: string | null;
  confidence: "high" | "low" | null;
  status: PreconRowStatus;
  version: number;
  verifiedBy: string | null;
  verifiedAt: string | null;
  /** Working days the task can slip without moving the finish; from the scheduler's backward pass. */
  totalFloatDays: number | null;
  isCritical: boolean;
  origin: ProgrammeTaskOrigin;
}

export const PROGRAMME_TASK_ORIGINS = ["ai", "manual", "prompt"] as const;
export type ProgrammeTaskOrigin = (typeof PROGRAMME_TASK_ORIGINS)[number];

/** Base plus the dates the server derives from the programme start date. */
export interface PreconProgrammeTask extends PreconProgrammeTaskBase {
  startAt: string;
  finishAt: string;
}

export interface PreconProgramme {
  sessionId: string;
  startDate: string;
  finishDate: string | null;
  tasks: PreconProgrammeTask[];
  progress: { total: number; verified: number };
}

export interface UpdateProgrammeTaskInput {
  version: number;
  name?: string;
  durationDays?: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  /** Target position in the list; the server renumbers everything else. */
  sort?: number;
  predecessors?: ProgrammeDependency[];
}

export interface CreateProgrammeTaskInput {
  name: string;
  durationDays: number;
  isMilestone?: boolean;
  basis?: string;
  outlineLevel?: number;
  afterTaskId?: string;
  predecessors?: ProgrammeDependency[];
}

export const preconApi = {
  listSessions: (proposalId?: string) =>
    api
      .get<PreconSession[]>(`/precon/sessions`, { params: proposalId ? { proposalId } : undefined })
      .then((r) => r.data),

  createSessionFromPlan: (proposalId: string, planId: string, scope: TakeoffScope) =>
    api.post<PreconSession>(`/precon/sessions/from-plan`, { proposalId, planId, scope }).then((r) => r.data),

  retrySession: (sessionId: string) =>
    api.post<PreconSession>(`/precon/sessions/${sessionId}/retry`).then((r) => r.data),

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

  createBill: (sessionId: string, title: string) =>
    api.post<PreconBill>(`/precon/sessions/${sessionId}/bills`, { title }).then((r) => r.data),

  renameBill: (billId: string, title: string) =>
    api.patch<PreconBill>(`/precon/bills/${billId}`, { title }).then((r) => r.data),

  deleteBill: (billId: string) => api.delete(`/precon/bills/${billId}`).then((r) => r.data),

  createRow: (billId: string, input: CreateRowInput) =>
    api.post<PreconBoqRow>(`/precon/bills/${billId}/rows`, input).then((r) => r.data),

  deleteRow: (rowId: string) => api.delete(`/precon/rows/${rowId}`).then((r) => r.data),

  updateRow: (rowId: string, input: UpdateRowInput) =>
    api.patch<PreconBoqRow>(`/precon/rows/${rowId}`, input).then((r) => r.data),

  verifyRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/verify`, { version }).then((r) => r.data),

  rejectRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/reject`, { version }).then((r) => r.data),

  updateGeometry: (
    rowId: string,
    input: { version: number; kind: PreconGeometryKind; vertices: number[][]; sheetId?: string },
  ) => api.put<PreconBoqRow>(`/precon/rows/${rowId}/geometry`, input).then((r) => r.data),

  addDeduction: (
    rowId: string,
    input: { version: number; label: string; vertices: number[][]; sheetId?: string },
  ) => api.post<PreconBoqRow>(`/precon/rows/${rowId}/deductions`, input).then((r) => r.data),

  updateSettings: (sessionId: string, patch: Partial<PreconSummarySettings>) =>
    api.patch<PreconSummarySettings>(`/precon/sessions/${sessionId}/settings`, patch).then((r) => r.data),

  snapIndex: (sheetId: string) =>
    api.get<{ points: number[][] }>(`/precon/sheets/${sheetId}/snap`).then((r) => r.data.points),

  sheetFileUrl: (sheetId: string) => `${api.defaults.baseURL ?? ""}/precon/sheets/${sheetId}/file`,

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

// ---- take-off → estimate (WS-3) ----

export type ApplyMode = "preview" | "apply";
export type ApplyChange = "added" | "changed" | "removed" | "unchanged";

export interface ApplyPreviewItem {
  groupLabel: string;
  description: string;
  qty: number;
  unit: string;
  unitRate: number;
  boqItemId: string | null;
  takeoffSessionId: string | null;
  change: ApplyChange;
  previous?: { qty: number; unit: string; description: string };
}

export interface ApplyPreview {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  items: ApplyPreviewItem[];
  written?: number;
}

export const preconApplyApi = {
  applyToEstimate: (sessionId: string, estimateId: string, mode: ApplyMode) =>
    api
      .post<ApplyPreview>(`/precon/sessions/${sessionId}/apply-to-estimate`, { estimateId, mode })
      .then((r) => r.data),
};
