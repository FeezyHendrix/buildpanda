/** Single source of truth for cache keys; every hook derives from here. */
export const organizationKeys = {
  all: ["organizations"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
};

export const projectKeys = {
  all: ["projects"] as const,
  list: (organizationId: string | undefined) =>
    [...projectKeys.all, "list", organizationId ?? "none"] as const,
  detail: (id: string | undefined) => [...projectKeys.all, "detail", id ?? "none"] as const,
};

export const activityKeys = {
  all: (projectId: string | undefined) => ["activities", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...activityKeys.all(projectId), "list"] as const,
};

export const documentKeys = {
  all: (projectId: string | undefined) => ["documents", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...documentKeys.all(projectId), "list"] as const,
};

export const rfiKeys = {
  all: (projectId: string | undefined) => ["rfis", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...rfiKeys.all(projectId), "list"] as const,
};

export const stageKeys = {
  all: (projectId: string | undefined) => ["stages", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...stageKeys.all(projectId), "list"] as const,
};

export const keyDateKeys = {
  all: (projectId: string | undefined) => ["key-dates", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...keyDateKeys.all(projectId), "list"] as const,
};

export const updateKeys = {
  all: (projectId: string | undefined) => ["updates", projectId ?? "none"] as const,
  list: (projectId: string | undefined) => [...updateKeys.all(projectId), "list"] as const,
};
