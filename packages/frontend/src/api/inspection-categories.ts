import api from "./client";

/**
 * "global" is BuildPanda's own service catalogue — the inspections the platform
 * offers on every project. "organization" and "project" are a workspace's own
 * additions on top of it.
 */
export type InspectionCategoryScope = "global" | "organization" | "project";

export interface InspectionCategoryOption {
  id: string;
  name: string;
  scope: InspectionCategoryScope;
  sortOrder: number;
  active: boolean;
  /** How many inspections hold it — a category in use is archived, never deleted. */
  usageCount: number;
}

export interface CreateInspectionCategoryInput {
  name: string;
  scope?: Exclude<InspectionCategoryScope, "global">;
}

export const inspectionCategoriesApi = {
  list: (projectId: string) =>
    api
      .get<InspectionCategoryOption[]>(`/projects/${projectId}/inspection-categories`)
      .then((r) => r.data),

  create: (projectId: string, body: CreateInspectionCategoryInput) =>
    api
      .post<InspectionCategoryOption>(`/projects/${projectId}/inspection-categories`, body)
      .then((r) => r.data),
};
