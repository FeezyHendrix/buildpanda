export interface SupplierRow {
  id: string;
  project_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  projectId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput> & { active?: boolean };
