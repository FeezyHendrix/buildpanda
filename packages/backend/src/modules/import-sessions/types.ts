export type ImportSessionStatus = "active" | "completed";

export type ImportDocKind = "programme" | "boq" | "drawing" | "ifc" | "project_file";

export type ImportDocStatus =
  | "pending"
  | "processing"
  | "ready"
  | "applied"
  | "skipped"
  | "failed";

export interface ImportSessionDocument {
  id: string;
  sessionId: string;
  kind: ImportDocKind;
  jobId: string | null;
  fileName: string | null;
  status: ImportDocStatus;
  error: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface ImportSession {
  id: string;
  projectId: string | null;
  status: ImportSessionStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSessionDetail extends ImportSession {
  documents: ImportSessionDocument[];
}

export interface ImportSessionRow {
  id: string;
  project_id: string | null;
  status: ImportSessionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportSessionDocumentRow {
  id: string;
  session_id: string;
  kind: ImportDocKind;
  job_id: string | null;
  file_name: string | null;
  status: ImportDocStatus;
  error: string | null;
  applied_at: string | null;
  created_at: string;
}
