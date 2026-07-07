import api from "./client";
import type { InspectionReport, InspectionCategory } from "@/lib/project-types";

export interface RequestInspectionVariables {
  projectId: string;
  title: string;
  category: Exclude<InspectionCategory, "All Reports">;
  description: string;
  scheduledAt: string;
}

export interface EditInspectionVariables {
  projectId: string;
  inspectionId: string;
  title?: string;
  category?: Exclude<InspectionCategory, "All Reports">;
  description?: string;
  scheduledAt?: string;
  status?: "Scheduled" | "Action Required" | "Completed";
  riskLevel?: "Low" | "Medium" | "High";
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

  delete: (projectId: string, inspectionId: string) =>
    api.delete(`/projects/${projectId}/inspections/${inspectionId}`).then((r) => r.data),
};
