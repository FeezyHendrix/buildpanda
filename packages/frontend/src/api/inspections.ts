import api from "./client";
import type { InspectionOutcome, InspectionReport, InspectionCategory } from "@/lib/project-types";

export interface InspectionFields {
  title: string;
  category: Exclude<InspectionCategory, "All Reports">;
  description: string;
  scheduledAt: string;
  activityId?: string | null;
  location?: string | null;
  holdPoint?: boolean;
}

export interface RequestInspectionVariables extends InspectionFields {
  projectId: string;
}

export interface EditInspectionVariables extends Partial<InspectionFields> {
  projectId: string;
  inspectionId: string;
  status?: "Scheduled" | "Action Required" | "Completed";
  riskLevel?: "Low" | "Medium" | "High";
}

export interface RecordInspectionOutcomeVariables {
  projectId: string;
  inspectionId: string;
  outcome: InspectionOutcome;
  findings?: string | null;
  reinspectionDate?: string | null;
  media?: { type: "photo" | "video"; url: string }[];
}

export interface DeleteInspectionVariables {
  projectId: string;
  inspectionId: string;
}

export const inspectionsApi = {
  list: (projectId: string) =>
    api.get<InspectionReport[]>(`/projects/${projectId}/inspections`).then((r) => r.data),

  request: (projectId: string, body: Omit<RequestInspectionVariables, "projectId">) =>
    api.post<InspectionReport>(`/projects/${projectId}/inspections`, body).then((r) => r.data),

  edit: (projectId: string, inspectionId: string, patch: Omit<EditInspectionVariables, "projectId" | "inspectionId">) =>
    api.put<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}`, patch).then((r) => r.data),

  recordOutcome: (
    projectId: string,
    inspectionId: string,
    body: Omit<RecordInspectionOutcomeVariables, "projectId" | "inspectionId">,
  ) =>
    api
      .post<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}/outcome`, body)
      .then((r) => r.data),

  delete: (projectId: string, inspectionId: string) =>
    api.delete(`/projects/${projectId}/inspections/${inspectionId}`).then((r) => r.data),
};
