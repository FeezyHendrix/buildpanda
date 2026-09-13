export type CategoryScope = "organization" | "project";

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
