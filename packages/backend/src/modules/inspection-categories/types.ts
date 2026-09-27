/**
 * "global" is BuildPanda's own service catalogue — the inspections the platform
 * offers, visible on every project. "organization" and "project" are a
 * customer's own additions on top of it.
 */
export type CategoryScope = "global" | "organization" | "project";

export interface InspectionCategoryRow {
  id: string;
  organization_id: string | null;
  project_id: string | null;
  name: string;
  sort_order: number;
  active: boolean;
  created_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface InspectionCategory {
  id: string;
  name: string;
  scope: CategoryScope;
  sortOrder: number;
  active: boolean;
  /** How many inspections hold it — a category in use is archived, never deleted. */
  usageCount: number;
}

export interface CategoryOwner {
  projectId: string;
  organizationId: string | null;
}

/** BuildPanda staff working on the catalogue itself rather than one project's view. */
export interface GlobalCatalogue {
  global: true;
}

/** Whose list a caller is reading or editing. */
export type CategoryAudience = CategoryOwner | GlobalCatalogue;

export interface CreateCategoryInput {
  name: string;
  scope?: CategoryScope;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}
