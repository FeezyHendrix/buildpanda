export interface SupplierRow {
  id: string;
  project_id: string | null;
  organization_id: string | null;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  trade: string | null;
  approved: boolean;
  lead_time_days: number | null;
  payment_terms: string | null;
  active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  projectId: string | null;
  organizationId: string | null;
  /** "project" = raised on this job; "organization" = on the company register. */
  scope: SupplierScope;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  trade: string | null;
  approved: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupplierScope = "project" | "organization";

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  trade?: string | null;
  approved?: boolean;
  leadTimeDays?: number | null;
  paymentTerms?: string | null;
  /** Company-wide account (Dangote, Total) rather than a job-specific supplier. */
  scope?: SupplierScope;
  /** Save anyway after the duplicate warning. */
  force?: boolean;
}

export type UpdateSupplierInput = Omit<CreateSupplierInput, "scope" | "force"> & {
  name?: string;
  active?: boolean;
};

/** Company + project scope a supplier read or write runs against. */
export interface SupplierOwner {
  projectId: string;
  organizationId: string | null;
}
