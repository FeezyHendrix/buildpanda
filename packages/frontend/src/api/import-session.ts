import api from "./client";

export type SessionDocumentKind = "programme" | "boq" | "drawing" | "ifc" | "project_file";
export type SessionDocumentStatus = "pending" | "processing" | "ready" | "applied" | "skipped" | "failed";
export type ImportSessionStatus = "active" | "completed";

export interface SessionDocument {
  id: string;
  sessionId: string;
  kind: SessionDocumentKind;
  jobId: string | null;
  fileName: string | null;
  status: SessionDocumentStatus;
  error: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface ImportSession {
  id: string;
  projectId: string | null;
  status: ImportSessionStatus;
  documents: SessionDocument[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const importSessionApi = {
  create: () =>
    api.post<ImportSession>("/import-sessions").then((r) => r.data),

  get: (sessionId: string) =>
    api.get<ImportSession>(`/import-sessions/${sessionId}`).then((r) => r.data),

  linkProject: (sessionId: string, projectId: string) =>
    api.post<void>(`/import-sessions/${sessionId}/project`, { projectId }).then((r) => r.data),

  attachDocument: (sessionId: string, body: { kind: SessionDocumentKind; jobId?: string; fileName?: string; status?: SessionDocumentStatus }) =>
    api.post<SessionDocument>(`/import-sessions/${sessionId}/documents`, body).then((r) => r.data),

  updateDocument: (sessionId: string, documentId: string, body: { jobId?: string; fileName?: string; status?: SessionDocumentStatus; error?: string | null }) =>
    api.patch<SessionDocument>(`/import-sessions/${sessionId}/documents/${documentId}`, body).then((r) => r.data),
};
