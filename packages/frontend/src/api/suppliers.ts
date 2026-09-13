import api from "./client";
import type { Supplier, SupplierScope } from "@/lib/project-types";

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  /** The trade a QS keeps the approved-supplier list by (aggregates, cement…). */
  trade?: string | null;
  approved?: boolean;
  leadTimeDays?: number | null;
  paymentTerms?: string | null;
  /** Only honoured on create: a workspace supplier is reusable on every job. */
  scope?: SupplierScope;
  /** Save anyway when the server has flagged an existing supplier as a match. */
  force?: boolean;
}

export type SupplierEditInput = Partial<Omit<SupplierInput, "scope" | "force">> & {
  active?: boolean;
};

export const suppliersApi = {
  list: (projectId: string, includeInactive?: boolean) =>
    api
      .get<Supplier[]>(`/projects/${projectId}/suppliers`, {
        params: includeInactive ? { includeInactive } : undefined,
      })
      .then((r) => r.data),

  create: (projectId: string, body: SupplierInput) =>
    api.post<Supplier>(`/projects/${projectId}/suppliers`, body).then((r) => r.data),

  /** The server's PATCH body takes no `scope`/`force` — a supplier cannot change side. */
  update: (projectId: string, supplierId: string, body: SupplierEditInput) =>
    api.put<Supplier>(`/projects/${projectId}/suppliers/${supplierId}`, body).then((r) => r.data),

  remove: (projectId: string, supplierId: string) =>
    api.delete(`/projects/${projectId}/suppliers/${supplierId}`).then((r) => r.data),
};
