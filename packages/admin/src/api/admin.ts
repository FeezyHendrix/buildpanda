import api from "./client";

export interface Paginated<T> {
  rows: T[];
  total: number;
}

export interface AdminOverview {
  counts: {
    users: number;
    organizations: number;
    projects: number;
    inspections: number;
    documents: number;
    openDisputes: number;
    unassignedLeads: number;
  };
  finance: { totalBudget: number; fundsReleased: number };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    progress_percent: number;
    created_at: string;
    ownerName: string | null;
    organizationName: string | null;
  }>;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  emailVerified: boolean;
  accountType: string | null;
  country: string | null;
  phone: string | null;
  profession: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
  organizationCount: number;
}

export interface AdminUserDetail extends Omit<AdminUserRow, "projectCount" | "organizationCount"> {
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: string;
    createdAt: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    progress_percent: number;
    created_at: string;
  }>;
}

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: string;
  memberCount: number;
  projectCount: number;
}

export interface AdminOrgDetail {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{ userId: string; name: string; email: string; role: string; createdAt: string }>;
  projects: Array<{ id: string; name: string; status: string; progress_percent: number; ownerName: string | null }>;
}

export interface AdminProjectRow {
  id: string;
  name: string;
  address: string | null;
  status: string;
  risk: string | null;
  progress_percent: number;
  budget_total: number | null;
  budget_used: number | null;
  currency: string;
  created_at: string;
  ownerName: string | null;
  ownerEmail: string | null;
  organizationName: string | null;
}

export interface AdminProjectDetail extends AdminProjectRow {
  finances: Record<string, unknown> | null;
  counts: {
    inspections: number;
    documents: number;
    activities: number;
    updates: number;
    risks: number;
    dailyLogs: number;
    milestones: number;
  };
  [key: string]: unknown;
}

export interface ListArgs {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

function params(args: ListArgs = {}) {
  const p: Record<string, string | number> = {};
  if (args.search) p.search = args.search;
  if (args.status) p.status = args.status;
  if (args.limit != null) p.limit = args.limit;
  if (args.offset != null) p.offset = args.offset;
  return p;
}

export interface AdminLeadRow {
  id: string;
  org_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  project_type: string | null;
  source: string;
  status: string;
  created_at: string;
  organizationName: string | null;
}

export const adminApi = {
  me: () =>
    api.get<{ id: string; name: string; email: string; role: string }>("/admin/me").then((r) => r.data),
  overview: () => api.get<AdminOverview>("/admin/overview").then((r) => r.data),

  listUsers: (args?: ListArgs) =>
    api.get<Paginated<AdminUserRow>>("/admin/users", { params: params(args) }).then((r) => r.data),
  getUser: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),
  updateUser: (id: string, body: { role?: string; banned?: boolean; banReason?: string }) =>
    api.patch<AdminUserDetail>(`/admin/users/${id}`, body).then((r) => r.data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),

  listOrganizations: (args?: ListArgs) =>
    api.get<Paginated<AdminOrgRow>>("/admin/organizations", { params: params(args) }).then((r) => r.data),
  getOrganization: (id: string) =>
    api.get<AdminOrgDetail>(`/admin/organizations/${id}`).then((r) => r.data),

  listProjects: (args?: ListArgs) =>
    api.get<Paginated<AdminProjectRow>>("/admin/projects", { params: params(args) }).then((r) => r.data),
  getProject: (id: string) => api.get<AdminProjectDetail>(`/admin/projects/${id}`).then((r) => r.data),
  projectCollection: <T = Record<string, unknown>>(id: string, kind: string) =>
    api.get<T>(`/admin/projects/${id}/${kind}`).then((r) => r.data),

  listLeads: (args?: ListArgs) =>
    api.get<Paginated<AdminLeadRow>>("/admin/leads", { params: params(args) }).then((r) => r.data),
  assignLead: (id: string, organizationId: string) =>
    api.post<AdminLeadRow>(`/admin/leads/${id}/assign`, { organizationId }).then((r) => r.data),
};
