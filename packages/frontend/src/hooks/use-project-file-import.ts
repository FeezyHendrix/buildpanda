import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

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

export function useStartProjectFileImport() {
  return useMutation({
    mutationFn: async ({ file, sessionId }: { file: File; sessionId?: string }) => {
      const form = new FormData();
      form.append("file", file);
      const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const { data } = await api.post<ProjectFileJob>(
        `/project-files/extract${query}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}

export function useProjectFileImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["project-file-import", jobId ?? "__none__"],
    queryFn: async () => {
      const { data } = await api.get<ProjectFileJob>(
        `/project-files/extract/${jobId!}`,
      );
      return data;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function useApplyProjectFile() {
  return useMutation({
    mutationFn: async ({
      jobId,
      projectId,
      selection,
    }: {
      jobId: string;
      projectId?: string;
      selection?: ApplyExtractionSelection;
    }) => {
      const { data } = await api.post<ApplyExtractionResult>(
        `/project-files/extract/${jobId}/apply`,
        { projectId, selection },
      );
      return data;
    },
  });
}
