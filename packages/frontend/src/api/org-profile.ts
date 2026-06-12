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
}

export interface UpdateOrgProfileInput {
  phone?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  defaultCurrency?: string;
  defaultTaxLabel?: string;
  defaultTaxPct?: number;
}

export const orgProfileApi = {
  get: () => api.get<OrgProfile>("/org-profile").then((r) => r.data),
  patch: (body: UpdateOrgProfileInput) =>
    api.patch<OrgProfile>("/org-profile", body).then((r) => r.data),
};
