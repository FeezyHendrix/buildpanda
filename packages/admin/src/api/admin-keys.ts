export type DateRangeArgs = { from?: string; to?: string };
export type ListArgs = { search?: string; status?: string; limit?: number; offset?: number };

export const adminKeys = {
  all: ["admin"] as const,
  me: () => [...adminKeys.all, "me"] as const,
  overview: () => [...adminKeys.all, "overview"] as const,
  metricsOverview: (range?: DateRangeArgs) => [...adminKeys.all, "metrics", "overview", range] as const,
  metricsGrowth: (range?: DateRangeArgs) => [...adminKeys.all, "metrics", "growth", range] as const,
  metricsEngagement: (range?: DateRangeArgs) => [...adminKeys.all, "metrics", "engagement", range] as const,
  metricsAiOps: (range?: DateRangeArgs) => [...adminKeys.all, "metrics", "ai-ops", range] as const,
  auditLog: (args?: { targetId?: string; adminUserId?: string; limit?: number; offset?: number }) => [...adminKeys.all, "audit-log", args] as const,
  
  users: {
    all: () => [...adminKeys.all, "users"] as const,
    list: (args: ListArgs) => [...adminKeys.users.all(), "list", args] as const,
    detail: (id: string) => [...adminKeys.users.all(), "detail", id] as const,
  },
  orgs: {
    all: () => [...adminKeys.all, "orgs"] as const,
    list: (args: ListArgs) => [...adminKeys.orgs.all(), "list", args] as const,
    detail: (id: string) => [...adminKeys.orgs.all(), "detail", id] as const,
  },
  projects: {
    all: () => [...adminKeys.all, "projects"] as const,
    list: (args: ListArgs) => [...adminKeys.projects.all(), "list", args] as const,
    detail: (id: string) => [...adminKeys.projects.all(), "detail", id] as const,
  },
  leads: {
    all: () => [...adminKeys.all, "leads"] as const,
    list: (args: ListArgs) => [...adminKeys.leads.all(), "list", args] as const,
  },
  importJobs: {
    all: () => [...adminKeys.all, "import-jobs"] as const,
    list: (args: ListArgs) => [...adminKeys.importJobs.all(), "list", args] as const,
    detail: (id: string) => [...adminKeys.importJobs.all(), "detail", id] as const,
  },
  settings: {
    all: () => [...adminKeys.all, "settings"] as const,
    maintenance: () => [...adminKeys.settings.all(), "maintenance"] as const,
    features: () => [...adminKeys.settings.all(), "features"] as const,
  }
};
