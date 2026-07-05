import api from "./client";

export interface OrgProfile {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  contactEmail: string | null;
  website: string | null;
  defaultCurrency: string;
  defaultTaxLabel: string;
  defaultTaxPct: number;
  paymentInstructions: string | null;
}

export interface UpdateOrgProfileInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  defaultCurrency?: string;
  defaultTaxLabel?: string;
  defaultTaxPct?: number;
  paymentInstructions?: string;
}

export interface OrgPermissions {
  organizationId: string;
  role: string | null;
  permissions: Record<string, string[]>;
}

export const orgProfileApi = {
  get: () => api.get<OrgProfile>("/org-profile").then((r) => r.data),
  patch: (body: UpdateOrgProfileInput) =>
    api.patch<OrgProfile>("/org-profile", body).then((r) => r.data),
  permissions: () =>
    api.get<OrgPermissions>("/org-permissions").then((r) => r.data),
};
