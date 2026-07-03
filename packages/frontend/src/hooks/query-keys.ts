export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

export const projectTemplateKeys = {
  all: ["project-templates"] as const,
  list: () => [...projectTemplateKeys.all, "list"] as const,
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
  versions: (projectId: string, documentId: string) =>
    [...documentKeys.all(projectId), "versions", documentId] as const,
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

export const materialKeys = {
  all: (projectId: string) => ["projects", projectId, "materials"] as const,
  orders: (projectId: string, status?: string) =>
    [...materialKeys.all(projectId), "orders", status ?? "all"] as const,
};

export const equipmentRequestKeys = {
  all: (projectId: string) => ["projects", projectId, "equipment-requests"] as const,
  list: (projectId: string, bucket?: string) =>
    [...equipmentRequestKeys.all(projectId), "list", bucket ?? "all"] as const,
};

export const invoiceKeys = {
  all: (projectId: string) => ["projects", projectId, "invoices"] as const,
  list: (projectId: string) => [...invoiceKeys.all(projectId), "list"] as const,
  detail: (projectId: string, invoiceId: string) => [...invoiceKeys.all(projectId), "detail", invoiceId] as const,
};

export const paymentClaimKeys = {
  all: (projectId: string) => ["projects", projectId, "payment-claims"] as const,
  list: (projectId: string) => [...paymentClaimKeys.all(projectId), "list"] as const,
};

export const purchaseOrderKeys = {
  all: (projectId: string) => ["projects", projectId, "purchase-orders"] as const,
  list: (projectId: string) => [...purchaseOrderKeys.all(projectId), "list"] as const,
};

export const budgetKeys = {
  all: (projectId: string) => ["projects", projectId, "budget"] as const,
  detail: (projectId: string) => [...budgetKeys.all(projectId), "detail"] as const,
};

export const riskKeys = {
  all: (projectId: string) =>
    ["projects", projectId, "risk-factors"] as const,
};

export const teamKeys = {
  all: (projectId: string) => ["projects", projectId, "team-members"] as const,
  list: (projectId: string) => [...teamKeys.all(projectId), "list"] as const,
};

export const activityKeys = {
  all: (projectId: string) => ["projects", projectId, "activities"] as const,
  list: (projectId: string) =>
    [...activityKeys.all(projectId), "list"] as const,
  detail: (projectId: string, activityId: string) =>
    [...activityKeys.all(projectId), "detail", activityId] as const,
};

export const stageKeys = {
  all: (projectId: string) => ["projects", projectId, "stages"] as const,
  list: (projectId: string) => [...stageKeys.all(projectId), "list"] as const,
};

export const actionItemKeys = {
  all: (projectId: string) => ["projects", projectId, "action-items"] as const,
  list: (projectId: string, status?: string) =>
    [...actionItemKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, itemId: string) =>
    [...actionItemKeys.all(projectId), "detail", itemId] as const,
};

export const siteQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "queries"] as const,
  list: (projectId: string, status?: string) =>
    [...siteQueryKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, queryId: string) =>
    [...siteQueryKeys.all(projectId), "detail", queryId] as const,
};

export const rfiKeys = {
  all: (projectId: string) => ["projects", projectId, "rfis"] as const,
  list: (projectId: string, status?: string) =>
    [...rfiKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, rfiId: string) =>
    [...rfiKeys.all(projectId), "detail", rfiId] as const,
};

export const bimKeys = {
  all: (projectId: string) => ["projects", projectId, "bim"] as const,
  models: (projectId: string) => [...bimKeys.all(projectId), "models"] as const,
  model: (projectId: string, modelId: string) =>
    [...bimKeys.all(projectId), "model", modelId] as const,
  issues: (projectId: string, modelId: string) =>
    [...bimKeys.all(projectId), "issues", modelId] as const,
};

export const approvalKeys = {
  all: (projectId: string) => ["projects", projectId, "approvals"] as const,
  list: (projectId: string, status?: string) =>
    [...approvalKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, approvalId: string) =>
    [...approvalKeys.all(projectId), "detail", approvalId] as const,
};

export const selectionKeys = {
  all: (projectId: string) => ["projects", projectId, "selections"] as const,
  list: (projectId: string, status?: string) =>
    [...selectionKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, selectionId: string) =>
    [...selectionKeys.all(projectId), "detail", selectionId] as const,
};

export const changeRequestKeys = {
  all: (projectId: string) => ["projects", projectId, "change-requests"] as const,
  list: (projectId: string, status?: string) =>
    [...changeRequestKeys.all(projectId), "list", status ?? "all"] as const,
  detail: (projectId: string, changeId: string) =>
    [...changeRequestKeys.all(projectId), "detail", changeId] as const,
};

export const permitKeys = {
  all: (projectId: string) => ["projects", projectId, "permits"] as const,
  list: (projectId: string) => [...permitKeys.all(projectId), "list"] as const,
};

export const keyDateKeys = {
  all: (projectId: string) => ["projects", projectId, "key-dates"] as const,
  list: (projectId: string) => [...keyDateKeys.all(projectId), "list"] as const,
};

export const insightKeys = {
  insights: (projectId: string) => ["projects", projectId, "insights"] as const,
  whatsNext: (projectId: string) => ["projects", projectId, "whats-next"] as const,
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
  list: (filters?: { unreadOnly?: boolean; limit?: number }) =>
    filters
      ? ([...notificationKeys.all, "list", filters] as const)
      : ([...notificationKeys.all, "list"] as const),
  preferences: ["notifications", "preferences"] as const,
};

export const searchKeys = {
  all: ["search"] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

export const delayReasonKeys = {
  all: ["delay-reasons"] as const,
};

export const organizationKeys = {
  all: ["organization"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
  active: () => [...organizationKeys.all, "active"] as const,
  full: (organizationId: string) =>
    [...organizationKeys.all, "full", organizationId] as const,
  members: (organizationId: string) =>
    [...organizationKeys.all, organizationId, "members"] as const,
  invitations: (organizationId: string) =>
    [...organizationKeys.all, organizationId, "invitations"] as const,
  roles: (organizationId: string) =>
    [...organizationKeys.all, organizationId, "roles"] as const,
  permissions: (organizationId: string) =>
    [...organizationKeys.all, organizationId, "permissions"] as const,
  userInvitations: () =>
    [...organizationKeys.all, "user-invitations"] as const,
};

export const pandaAiKeys = {
  all: (projectId: string) => ["projects", projectId, "ai-insights"] as const,
  latest: (projectId: string) =>
    [...pandaAiKeys.all(projectId), "latest"] as const,
  detectedPhases: (projectId: string) =>
    [...pandaAiKeys.all(projectId), "detected-phases"] as const,
};

export const reportingKeys = {
  all: (projectId: string) => ["projects", projectId, "reporting"] as const,
  snapshot: (projectId: string) =>
    [...reportingKeys.all(projectId), "snapshot"] as const,
};

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters?: { status?: string }) =>
    filters
      ? ([...leadKeys.all, "list", filters] as const)
      : ([...leadKeys.all, "list"] as const),
};

export const orgProfileKeys = {
  all: ["org-profile"] as const,
  detail: () => [...orgProfileKeys.all, "detail"] as const,
};

export const proposalKeys = {
  all: ["proposals"] as const,
  list: (filters?: { status?: string; limit?: number; offset?: number }) =>
    filters
      ? ([...proposalKeys.all, "list", filters] as const)
      : ([...proposalKeys.all, "list"] as const),
  detail: (id: string) => [...proposalKeys.all, "detail", id] as const,
  comments: (id: string) => [...proposalKeys.detail(id), "comments"] as const,
  plans: (id: string) => [...proposalKeys.detail(id), "plans"] as const,
  boq: (id: string) => [...proposalKeys.detail(id), "boq"] as const,
  takeoffs: (id: string) => [...proposalKeys.detail(id), "automated-takeoff"] as const,
  publicView: (token: string) => [...proposalKeys.all, "public", token] as const,
};

export const channelKeys = {
  all: ["channels"] as const,
  list: () => [...channelKeys.all, "list"] as const,
  project: (projectId: string) => ["projects", projectId, "channels"] as const,
  detail: (channelId: string) => [...channelKeys.all, "detail", channelId] as const,
  members: (channelId: string) => [...channelKeys.all, channelId, "members"] as const,
};

export const messageKeys = {
  all: (channelId: string) => ["channels", channelId, "messages"] as const,
  list: (channelId: string) => [...messageKeys.all(channelId), "list"] as const,
};

export const taskKeys = {
  all: (projectId: string) => ["projects", projectId, "tasks"] as const,
  board: (projectId: string) => [...taskKeys.all(projectId), "board"] as const,
  assignable: (projectId: string) => [...taskKeys.all(projectId), "assignable"] as const,
  detail: (projectId: string, taskId: string) => [...taskKeys.all(projectId), "detail", taskId] as const,
};

export const materialLedgerKeys = {
  all: (projectId: string) => ["projects", projectId, "material-ledger"] as const,
  stock: (projectId: string) => [...materialLedgerKeys.all(projectId), "stock"] as const,
  ledger: (projectId: string, materialId?: string, entryType?: string) =>
    [...materialLedgerKeys.all(projectId), "ledger", materialId ?? "all", entryType ?? "all"] as const,
  catalog: (projectId: string) => [...materialLedgerKeys.all(projectId), "catalog"] as const,
};
