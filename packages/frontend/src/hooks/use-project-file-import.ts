import { useMutation, useQuery } from "@tanstack/react-query";
import {
  projectFileImportApi,
  type ProjectFileJobStatus,
  type ExtractedMetadata,
  type ExtractedPhase,
  type ExtractedBudgetCategory,
  type ExtractedMaterial,
  type ProjectExtraction,
  type ProjectFileJob,
  type ApplyExtractionSelection,
  type ApplyExtractionResult,
} from "@/api/project-file-import";

export type {
  ProjectFileJobStatus,
  ExtractedMetadata,
  ExtractedPhase,
  ExtractedBudgetCategory,
  ExtractedMaterial,
  ProjectExtraction,
  ProjectFileJob,
  ApplyExtractionSelection,
  ApplyExtractionResult,
};

export function useStartProjectFileImport() {
  return useMutation({
    mutationFn: async ({ file, sessionId }: { file: File; sessionId?: string }) => {
      return projectFileImportApi.startImport(file, sessionId);
    },
  });
}

export function useProjectFileImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["project-file-import", jobId ?? "__none__"],
    queryFn: async () => {
      return projectFileImportApi.getJob(jobId!);
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
      return projectFileImportApi.apply(jobId, { projectId, selection });
    },
  });
}
