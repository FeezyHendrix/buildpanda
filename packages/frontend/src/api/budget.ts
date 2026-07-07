import api from "./client";


export interface BudgetCategory {
  id: string;
  name: string;
  costCode: string | null;
  planned: number;
  committed: number;
  actual: number;
  effectivePlanned: number;
  projectedPlanned: number;
  effectiveCommitted: number;
  effectiveActual: number;
  notes: string | null;
  variance: number;
  variancePercentage: number;
  remaining: number;
  percentSpent: number;
}

export interface BudgetPeriod {
  id: string;
  period: string;
  planned: number;
  actual: number;
  notes: string | null;
  variance: number;
}

export interface BudgetSummary {
  totalPlanned: number;
  totalCommitted: number;
  totalActual: number;
  totalVariance: number;
  totalRemaining: number;
  percentCommitted: number;
  percentSpent: number;
  categoryCount: number;
  overBudgetCount: number;
  periodPlanned: number;
  periodActual: number;
}

export interface ProjectBudget {
  projectId: string;
  categories: BudgetCategory[];
  periods: BudgetPeriod[];
  summary: BudgetSummary;
}

export interface BudgetCategoryInput {
  name: string;
  costCode?: string;
  planned?: number;
  committed?: number;
  actual?: number;
  notes?: string;
}

export interface BudgetPeriodInput {
  period: string;
  planned?: number;
  actual?: number;
  notes?: string;
}

export interface CreateCategoryVariables extends BudgetCategoryInput {
  projectId: string;
}

export interface EditCategoryVariables extends Partial<BudgetCategoryInput> {
  projectId: string;
  categoryId: string;
}

export interface DeleteCategoryVariables {
  projectId: string;
  categoryId: string;
}

export interface CreatePeriodVariables extends BudgetPeriodInput {
  projectId: string;
}

export interface EditPeriodVariables extends Partial<BudgetPeriodInput> {
  projectId: string;
  periodId: string;
}

export interface DeletePeriodVariables {
  projectId: string;
  periodId: string;
}

export interface SeedBudgetInput {
  items: Array<{ groupLabel: string; total: number; costCode?: string }>;
  mode?: "skip" | "replace";
}

export const budgetApi = {
  detail: (projectId: string) =>
    api.get<ProjectBudget>(`/projects/${projectId}/budget`).then((r) => r.data),

  createCategory: (projectId: string, body: BudgetCategoryInput) =>
    api.post<BudgetCategory>(`/projects/${projectId}/budget/categories`, body).then((r) => r.data),

  updateCategory: (projectId: string, categoryId: string, patch: Partial<BudgetCategoryInput>) =>
    api.put<BudgetCategory>(`/projects/${projectId}/budget/categories/${categoryId}`, patch).then((r) => r.data),

  deleteCategory: (projectId: string, categoryId: string) =>
    api.delete(`/projects/${projectId}/budget/categories/${categoryId}`).then((r) => r.data),

  createPeriod: (projectId: string, body: BudgetPeriodInput) =>
    api.post<BudgetPeriod>(`/projects/${projectId}/budget/periods`, body).then((r) => r.data),

  updatePeriod: (projectId: string, periodId: string, patch: Partial<BudgetPeriodInput>) =>
    api.put<BudgetPeriod>(`/projects/${projectId}/budget/periods/${periodId}`, patch).then((r) => r.data),

  deletePeriod: (projectId: string, periodId: string) =>
    api.delete(`/projects/${projectId}/budget/periods/${periodId}`).then((r) => r.data),

  seedFromEstimate: (projectId: string, body: SeedBudgetInput) =>
    api.post<{ created: number; skipped: number }>(`/projects/${projectId}/budget/seed-from-estimate`, body).then((r) => r.data),
};
