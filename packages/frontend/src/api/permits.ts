import api from "./client";
import type { Permit, PermitStatus } from "@/lib/project-types";

export interface PermitInput {
  title: string;
  authority?: string | null;
  referenceNo?: string | null;
  status?: PermitStatus;
  appliedDate?: string | null;
  approvedDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

export const permitsApi = {
  list: (projectId: string) =>
    api.get<Permit[]>(`/projects/${projectId}/permits`).then((r) => r.data),

  create: (projectId: string, body: PermitInput) =>
    api.post<Permit>(`/projects/${projectId}/permits`, body).then((r) => r.data),

  update: (projectId: string, permitId: string, body: Partial<PermitInput>) =>
    api.patch<Permit>(`/projects/${projectId}/permits/${permitId}`, body).then((r) => r.data),

  remove: (projectId: string, permitId: string) =>
    api.delete(`/projects/${projectId}/permits/${permitId}`).then((r) => r.data),
};
