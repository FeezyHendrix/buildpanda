import api from "./client";

export const ASSIST_SURFACES = ["bill", "programme", "estimate", "pack", "risks"] as const;
export type AssistSurface = (typeof ASSIST_SURFACES)[number];

export type ChangeSetStatus = "proposed" | "applied" | "undone" | "discarded";
export type ChangeOp = "update" | "create" | "delete";
export type ChangeEntity = "boq_row" | "programme_task" | "estimate_item" | "pack_section" | "risk" | "sheet" | "viewer";
export type ViewerTool = "select" | "area" | "linear" | "count" | "deduct" | "scale";
export type ViewerZoom = "in" | "out" | "fit";
export interface ViewerCommand {
  tool?: ViewerTool;
  sheetId?: string;
  zoom?: ViewerZoom;
}
export interface AssistViewerContext {
  activeSheetId?: string;
  tool?: ViewerTool;
}

export interface AssistChange {
  op: ChangeOp;
  entity: ChangeEntity;
  id?: string;
  before?: Record<string, unknown> | null;
  after: Record<string, unknown>;
  label?: string;
}

export interface AppliedChange {
  index: number;
  outcome: "applied" | "skipped";
  reason?: string;
}

export interface AppliedResult {
  applied: number;
  skipped: number;
  changes: AppliedChange[];
}

export interface ChangeSet {
  id: string;
  sessionId: string | null;
  proposalId: string | null;
  surface: AssistSurface;
  prompt: string;
  plan: string[];
  changes: AssistChange[];
  status: ChangeSetStatus;
  appliedResult: AppliedResult | null;
  createdBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface AssistRequest {
  sessionId?: string;
  proposalId?: string;
  surface: AssistSurface;
  prompt: string;
  context?: AssistViewerContext;
}

export const preconAssistApi = {
  propose: (body: AssistRequest) =>
    // the model call can take a while; the 15s default would abort a real plan
    api.post<ChangeSet>("/precon/assist", body, { timeout: 90_000 }).then((r) => r.data),
  get: (changeSetId: string) => api.get<ChangeSet>(`/precon/change-sets/${changeSetId}`).then((r) => r.data),
  listForSession: (sessionId: string) =>
    api.get<ChangeSet[]>(`/precon/sessions/${sessionId}/change-sets`).then((r) => r.data),
  apply: (changeSetId: string) =>
    api.post<ChangeSet>(`/precon/change-sets/${changeSetId}/apply`, undefined, { timeout: 60_000 }).then((r) => r.data),
  undo: (changeSetId: string) =>
    api.post<ChangeSet>(`/precon/change-sets/${changeSetId}/undo`, undefined, { timeout: 60_000 }).then((r) => r.data),
  discard: (changeSetId: string) => api.post<ChangeSet>(`/precon/change-sets/${changeSetId}/discard`).then((r) => r.data),
};
