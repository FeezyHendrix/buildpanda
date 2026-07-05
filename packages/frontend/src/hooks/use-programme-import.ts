import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  programmeImportApi,
  type ProgrammeJobStatus,
  type ProgrammeDependencyType,
  type ProgrammeDependency,
  type ProgrammeActivity,
  type ProgrammePhase,
  type StructuredProgramme,
  type ProgrammeImportJob,
  type ApplyProgrammeInput,
  type ApplyProgrammeResult,
} from "@/api/programme-import";
import { activityKeys, projectKeys, stageKeys } from "./query-keys";

export type {
  ProgrammeJobStatus,
  ProgrammeDependencyType,
  ProgrammeDependency,
  ProgrammeActivity,
  ProgrammePhase,
  StructuredProgramme,
  ProgrammeImportJob,
  ApplyProgrammeInput,
  ApplyProgrammeResult,
};

export function useStartProgrammeImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      return programmeImportApi.startImport(file);
    },
  });
}

export function useProgrammeImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["programme-import", jobId ?? "__none__"],
    queryFn: async () => {
      return programmeImportApi.getJob(jobId!);
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function useApplyProgramme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, input }: { jobId: string; input: ApplyProgrammeInput }) => {
      return programmeImportApi.apply(jobId, input);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(res.projectId) });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(res.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(res.projectId) });
    },
  });
}
