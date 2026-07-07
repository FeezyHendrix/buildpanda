import api from "./client";
import type { Supplier } from "@/lib/project-types";

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export const suppliersApi = {
  list: (projectId: string, includeInactive?: boolean) =>
    api
      .get<Supplier[]>(`/projects/${projectId}/suppliers`, {
        params: includeInactive ? { includeInactive } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: SupplierInput) =>
    api.post<Supplier>(`/projects/${projectId}/suppliers`, body).then((r) => r.data),

  update: (projectId: string, supplierId: string, body: Partial<SupplierInput> & { active?: boolean }) =>
    api.put<Supplier>(`/projects/${projectId}/suppliers/${supplierId}`, body).then((r) => r.data),

  remove: (projectId: string, supplierId: string) =>
    api.delete(`/projects/${projectId}/suppliers/${supplierId}`).then((r) => r.data),
};
