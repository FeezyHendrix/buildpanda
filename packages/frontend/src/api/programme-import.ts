import api from "./client";

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
  parentRefId: string | null;
  startAt: string;
  endAt: string;
  durationDays: number | null;
  percentComplete: number;
  isSummary: boolean;
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
  sourceTaskCount: number;
  skippedTaskCount: number;
  summaryActivityCount: number;
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
  sourceTaskCount: number;
  skippedTaskCount: number;
  summaryActivityCount: number;
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

export const programmeImportApi = {
  async startImport(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post<ProgrammeImportJob>(
      "/projects/import/programme",
      form,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: 0 }
    );
    return response.data;
  },

  getJob: (jobId: string) =>
    api.get<ProgrammeImportJob>(`/projects/import/programme/${jobId}`).then((r) => r.data),

  apply: (jobId: string, input: ApplyProgrammeInput) =>
    api.post<ApplyProgrammeResult>(`/projects/import/programme/${jobId}/apply`, input).then((r) => r.data),
};
