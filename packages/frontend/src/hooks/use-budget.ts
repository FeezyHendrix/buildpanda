import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { budgetKeys, financeKeys } from "./query-keys";

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

export function useProjectBudget(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? budgetKeys.detail(projectId)
      : budgetKeys.detail("__none__"),
    queryFn: async () => {
      const { data } = await api.get<ProjectBudget>(`/projects/${projectId!}/budget`);
      return data;
    },
    enabled: Boolean(projectId),
  });
}

interface CreateCategoryVariables extends BudgetCategoryInput {
  projectId: string;
}

export function useCreateBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreateCategoryVariables) => {
      const { data } = await api.post<BudgetCategory>(
        `/projects/${projectId}/budget/categories`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface EditCategoryVariables extends Partial<BudgetCategoryInput> {
  projectId: string;
  categoryId: string;
}

export function useEditBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      categoryId,
      ...patch
    }: EditCategoryVariables) => {
      const { data } = await api.put<BudgetCategory>(
        `/projects/${projectId}/budget/categories/${categoryId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface DeleteCategoryVariables {
  projectId: string;
  categoryId: string;
}

export function useDeleteBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, categoryId }: DeleteCategoryVariables) => {
      await api.delete(`/projects/${projectId}/budget/categories/${categoryId}`);
    },
    onSuccess: (_variables, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}

interface CreatePeriodVariables extends BudgetPeriodInput {
  projectId: string;
}

export function useCreateBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, ...body }: CreatePeriodVariables) => {
      const { data } = await api.post<BudgetPeriod>(
        `/projects/${projectId}/budget/periods`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface EditPeriodVariables extends Partial<BudgetPeriodInput> {
  projectId: string;
  periodId: string;
}

export function useEditBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      periodId,
      ...patch
    }: EditPeriodVariables) => {
      const { data } = await api.put<BudgetPeriod>(
        `/projects/${projectId}/budget/periods/${periodId}`,
        patch,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

interface DeletePeriodVariables {
  projectId: string;
  periodId: string;
}

export function useDeleteBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, periodId }: DeletePeriodVariables) => {
      await api.delete(`/projects/${projectId}/budget/periods/${periodId}`);
    },
    onSuccess: (_variables, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}

export interface SeedBudgetInput {
  items: Array<{ groupLabel: string; total: number; costCode?: string }>;
  mode?: "skip" | "replace";
}

export function useSeedBudgetFromEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      ...body
    }: SeedBudgetInput & { projectId: string }) => {
      const { data } = await api.post<{ created: number; skipped: number }>(
        `/projects/${projectId}/budget/seed-from-estimate`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}
