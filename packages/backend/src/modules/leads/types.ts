export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "ProposalOpened",
  "Won",
  "Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadRow {
  id: string;
  org_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  project_type: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  assigned_to: string | null;
  notes: string | null;
  adopted_by: string | null;
  adopted_at: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface CreateLeadInput {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  projectType?: string;
  message?: string;
  source?: string;
  orgId?: string | null;
}
