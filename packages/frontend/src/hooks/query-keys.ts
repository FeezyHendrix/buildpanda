export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export const updateKeys = {
  all: (projectId: string) => ["projects", projectId, "updates"] as const,
  list: (projectId: string) => [...updateKeys.all(projectId), "list"] as const,
  comments: (projectId: string, updateId: string) =>
    [...updateKeys.all(projectId), updateId, "comments"] as const,
};

export const documentKeys = {
  all: (projectId: string) => ["projects", projectId, "documents"] as const,
  list: (projectId: string) => [...documentKeys.all(projectId), "list"] as const,
  categories: (projectId: string) =>
    [...documentKeys.all(projectId), "categories"] as const,
};

export const inspectionKeys = {
  all: (projectId: string) => ["projects", projectId, "inspections"] as const,
  list: (projectId: string) =>
    [...inspectionKeys.all(projectId), "list"] as const,
};

export const financeKeys = {
  all: (projectId: string) => ["projects", projectId, "finances"] as const,
  summary: (projectId: string) =>
    [...financeKeys.all(projectId), "summary"] as const,
  milestoneDisputes: (projectId: string, milestoneId: string) =>
    [
      ...financeKeys.all(projectId),
      "milestones",
      milestoneId,
      "disputes",
    ] as const,
};

export const invoiceKeys = {
  all: (projectId: string) => ["projects", projectId, "invoices"] as const,
  list: (projectId: string) => [...invoiceKeys.all(projectId), "list"] as const,
};

export const budgetKeys = {
  all: (projectId: string) => ["projects", projectId, "budget"] as const,
  detail: (projectId: string) => [...budgetKeys.all(projectId), "detail"] as const,
};

export const riskKeys = {
  all: (projectId: string) =>
    ["projects", projectId, "risk-factors"] as const,
};

export const activityKeys = {
  all: (projectId: string) => ["projects", projectId, "activities"] as const,
  list: (projectId: string) =>
    [...activityKeys.all(projectId), "list"] as const,
  detail: (projectId: string, activityId: string) =>
    [...activityKeys.all(projectId), "detail", activityId] as const,
};

export const dailyLogKeys = {
  all: (projectId: string) => ["projects", projectId, "daily-logs"] as const,
  list: (projectId: string, range?: { from?: string; to?: string }) =>
    range
      ? ([...dailyLogKeys.all(projectId), "list", range] as const)
      : ([...dailyLogKeys.all(projectId), "list"] as const),
  detail: (projectId: string, date: string) =>
    [...dailyLogKeys.all(projectId), "detail", date] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters?: { unreadOnly?: boolean }) =>
    filters
      ? ([...notificationKeys.all, "list", filters] as const)
      : ([...notificationKeys.all, "list"] as const),
};

export const searchKeys = {
  all: ["search"] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

export const delayReasonKeys = {
  all: ["delay-reasons"] as const,
};
