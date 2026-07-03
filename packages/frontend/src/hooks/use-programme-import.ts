import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { activityKeys, projectKeys, stageKeys } from "./query-keys";

export type ProgrammeJobStatus = "pending" | "processing" | "completed" | "failed" | "applied";

export type ProgrammeDependencyType = "FS" | "SS" | "FF" | "SF";

export interface ProgrammeDependency {
  refId: string;
  type: ProgrammeDependencyType;
  lagDays: number;
}

export interface ProgrammeActivity {
  refId: string;
  name: string;
  phaseKey: string;
  wbsCode: string | null;
  outlineLevel: number;
  startAt: string;
  endAt: string;
  durationDays: number | null;
  percentComplete: number;
  isMilestone: boolean;
  predecessors: ProgrammeDependency[];
  cost: number;
}

export interface ProgrammePhase {
  key: string;
  name: string;
  sort: number;
}

export interface StructuredProgramme {
  projectName: string;
  startAt: string | null;
  endAt: string | null;
  phases: ProgrammePhase[];
  activities: ProgrammeActivity[];
  usedAi: boolean;
}

export interface ProgrammeImportJob {
  id: string;
  status: ProgrammeJobStatus;
  fileName: string;
  activityCount: number;
  phaseCount: number;
  usedAi: boolean;
  createdProjectId: string | null;
  error: string | null;
  result: StructuredProgramme | null;
}

export interface ApplyProgrammeInput {
  projectId?: string;
  projectName?: string;
  city?: string;
  state?: string;
  budgetTotal?: number;
  currency?: string;
}

export interface ApplyProgrammeResult {
  projectId: string;
  phaseCount: number;
  activityCount: number;
  milestoneCount: number;
  totalCost: number;
}

export function useStartProgrammeImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ProgrammeImportJob>(
        "/projects/import/programme",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
}

export function useProgrammeImportJob(jobId: string | null) {
  return useQuery({
    queryKey: ["programme-import", jobId ?? "__none__"],
    queryFn: async () => {
      const { data } = await api.get<ProgrammeImportJob>(
        `/projects/import/programme/${jobId!}`,
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

export function useApplyProgramme() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, input }: { jobId: string; input: ApplyProgrammeInput }) => {
      const { data } = await api.post<ApplyProgrammeResult>(
        `/projects/import/programme/${jobId}/apply`,
        input,
      );
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.all(res.projectId) });
      queryClient.invalidateQueries({ queryKey: stageKeys.all(res.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(res.projectId) });
    },
  });
}
