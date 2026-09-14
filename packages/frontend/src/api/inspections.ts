import api from "./client";
import type { InspectionOutcome, InspectionReport } from "@/lib/project-types";

/**
 * An inspection is a client-facing service order. The client requests it, a
 * BuildPanda inspector attends and issues the report, and the contractor is
 * its subject. Any fee is a figure recorded against the order — BuildPanda
 * moves no money.
 */
export interface InspectionFields {
  title: string;
  /** A name from the project's category list (`inspection-categories`). */
  category: string;
  description: string;
  scheduledAt: string;
  activityId?: string | null;
  location?: string | null;
  holdPoint?: boolean;
  /** The party being inspected; defaults to the project's contractor entity. */
  contractorName?: string | null;
  feeAmount?: number | null;
  feeCurrency?: string | null;
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

export interface InspectionRefVariables {
  projectId: string;
  inspectionId: string;
}

export interface CancelInspectionVariables extends InspectionRefVariables {
  /** Why it was called off. Sent with the cancellation so it travels with it. */
  reason: string;
}

export const inspectionsApi = {
  list: (projectId: string) =>
    api.get<InspectionReport[]>(`/projects/${projectId}/inspections`).then((r) => r.data),

  request: (projectId: string, body: Omit<RequestInspectionVariables, "projectId">) =>
    api.post<InspectionReport>(`/projects/${projectId}/inspections`, body).then((r) => r.data),

  edit: (
    projectId: string,
    inspectionId: string,
    patch: Omit<EditInspectionVariables, "projectId" | "inspectionId">,
  ) =>
    api
      .put<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}`, patch)
      .then((r) => r.data),

  /** The assigned inspector confirming they attended site. */
  markAttended: (projectId: string, inspectionId: string) =>
    api
      .post<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}/attended`)
      .then((r) => r.data),

  recordOutcome: (
    projectId: string,
    inspectionId: string,
    body: Omit<RecordInspectionOutcomeVariables, "projectId" | "inspectionId">,
  ) =>
    api
      .post<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}/outcome`, body)
      .then((r) => r.data),

  /** The requester calling the service order off. Refused once reported. */
  cancel: (projectId: string, inspectionId: string, body: { reason: string }) =>
    api
      .post<InspectionReport>(`/projects/${projectId}/inspections/${inspectionId}/cancel`, body)
      .then((r) => r.data),

  delete: (projectId: string, inspectionId: string) =>
    api.delete(`/projects/${projectId}/inspections/${inspectionId}`).then((r) => r.data),
};
