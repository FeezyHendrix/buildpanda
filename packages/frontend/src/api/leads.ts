import api from "./client";

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "ProposalOpened",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  orgId: string | null;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  projectType: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  assignedTo: string | null;
  notes: string | null;
  adoptedBy: string | null;
  adoptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLeads {
  rows: Lead[];
  total: number;
}

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  projectType?: string;
  message?: string;
}

export const leadsApi = {
  list: (args?: { status?: string; limit?: number; offset?: number }) =>
    api
      .get<PaginatedLeads>("/leads", { params: args })
      .then((r) => r.data),

  create: (body: CreateLeadInput) =>
    api.post<Lead>("/leads", body).then((r) => r.data),

  patch: (id: string, body: { status?: LeadStatus; notes?: string }) =>
    api.patch<Lead>(`/leads/${id}`, body).then((r) => r.data),
};
