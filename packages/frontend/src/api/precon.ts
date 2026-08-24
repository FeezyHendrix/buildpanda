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
export type PreconSheetKind = "floor-plan" | "elevation" | "section" | "detail" | "schedule" | "unknown";
export type PreconRowType = "heading" | "work_section" | "spec_note" | "item" | "provisional_sum";

export interface PreconSession {
  id: string;
  orgId: string;
  projectId: string | null;
  proposalId: string | null;
  status: PreconSessionStatus;
  title: string;
  error: string | null;
  structureContext: StructureContext | null;
  createdBy: string | null;
  createdAt: string;
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
}

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
}

export const preconApi = {
  listSessions: (proposalId?: string) =>
    api
      .get<PreconSession[]>(`/precon/sessions`, { params: proposalId ? { proposalId } : undefined })
      .then((r) => r.data),

  createSessionFromPlan: (proposalId: string, planId: string) =>
    api.post<PreconSession>(`/precon/sessions/from-plan`, { proposalId, planId }).then((r) => r.data),

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

  snapshot: (sessionId: string) => api.get<PreconSnapshot>(`/precon/sessions/${sessionId}`).then((r) => r.data),

  updateRow: (rowId: string, input: UpdateRowInput) =>
    api.patch<PreconBoqRow>(`/precon/rows/${rowId}`, input).then((r) => r.data),

  verifyRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/verify`, { version }).then((r) => r.data),

  rejectRow: (rowId: string, version: number) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/reject`, { version }).then((r) => r.data),

  updateGeometry: (rowId: string, input: { version: number; kind: PreconGeometryKind; vertices: number[][] }) =>
    api.put<PreconBoqRow>(`/precon/rows/${rowId}/geometry`, input).then((r) => r.data),

  addDeduction: (rowId: string, input: { version: number; label: string; vertices: number[][] }) =>
    api.post<PreconBoqRow>(`/precon/rows/${rowId}/deductions`, input).then((r) => r.data),

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

  verifyProgrammeTask: (taskId: string, version: number) =>
    api.post<PreconProgrammeTaskBase>(`/precon/programme-tasks/${taskId}/verify`, { version }).then((r) => r.data),

  rejectProgrammeTask: (taskId: string, version: number) =>
    api.post<PreconProgrammeTaskBase>(`/precon/programme-tasks/${taskId}/reject`, { version }).then((r) => r.data),

  applyToProposal: (sessionId: string) =>
    api
      .post<{ proposalId: string; itemCount: number }>(`/precon/sessions/${sessionId}/apply-to-proposal`)
      .then((r) => r.data),
};
