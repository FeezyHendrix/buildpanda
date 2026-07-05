import api from "./client";

export type ProjectFileJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "applied";

export interface ExtractedMetadata {
  projectName: string | null;
  location: string | null;
  client: string | null;
  contractor: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

export interface ExtractedPhase {
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ExtractedBudgetCategory {
  name: string;
  total: number;
}

export interface ExtractedMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  section: string | null;
}

export interface ProjectExtraction {
  metadata: ExtractedMetadata;
  phases: ExtractedPhase[];
  budgetCategories: ExtractedBudgetCategory[];
  materials: ExtractedMaterial[];
  sheets: { name: string; domain: string; rowCount: number }[];
}

export interface ProjectFileJob {
  id: string;
  status: ProjectFileJobStatus;
  fileName: string;
  projectId: string | null;
  error: string | null;
  extraction: ProjectExtraction | null;
}

export interface ApplyExtractionSelection {
  metadata?: boolean;
  timeline?: boolean;
  budget?: boolean;
  materials?: boolean;
}

export interface ApplyExtractionResult {
  projectId: string;
  createdProject: boolean;
  phaseCount: number;
  budgetCategoryCount: number;
  materialCount: number;
}

export const projectFileImportApi = {
  startImport: (file: File, sessionId?: string) => {
    const form = new FormData();
    form.append("file", file);
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return api.post<ProjectFileJob>(
      `/project-files/extract${query}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    ).then((r) => r.data);
  },

  getJob: (jobId: string) =>
    api.get<ProjectFileJob>(`/project-files/extract/${jobId}`).then((r) => r.data),

  apply: (jobId: string, body: { projectId?: string; selection?: ApplyExtractionSelection }) =>
    api.post<ApplyExtractionResult>(`/project-files/extract/${jobId}/apply`, body).then((r) => r.data),
};
