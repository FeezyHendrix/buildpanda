import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetKeys, financeKeys } from "./query-keys";
import { budgetApi, type CreateCategoryVariables, type EditCategoryVariables, type DeleteCategoryVariables, type CreatePeriodVariables, type EditPeriodVariables, type DeletePeriodVariables, type SeedBudgetInput } from "@/api/budget";

export type {
  BudgetCategory,
  BudgetPeriod,
  BudgetSummary,
  ProjectBudget,
  BudgetCategoryInput,
  BudgetPeriodInput,
  CreateCategoryVariables,
  EditCategoryVariables,
  DeleteCategoryVariables,
  CreatePeriodVariables,
  EditPeriodVariables,
  DeletePeriodVariables,
  SeedBudgetInput,
} from "@/api/budget";

export function useProjectBudget(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? budgetKeys.detail(projectId)
      : budgetKeys.detail("__none__"),
    queryFn: () => budgetApi.detail(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreateCategoryVariables) => budgetApi.createCategory(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

export function useEditBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, categoryId, ...patch }: EditCategoryVariables) => budgetApi.updateCategory(projectId, categoryId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

export function useDeleteBudgetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, categoryId }: DeleteCategoryVariables) => budgetApi.deleteCategory(projectId, categoryId),
    onSuccess: (_variables, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}

export function useCreateBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: CreatePeriodVariables) => budgetApi.createPeriod(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

export function useEditBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, periodId, ...patch }: EditPeriodVariables) => budgetApi.updatePeriod(projectId, periodId, patch),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: financeKeys.summary(projectId) });
    },
  });
}

export function useDeleteBudgetPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, periodId }: DeletePeriodVariables) => budgetApi.deletePeriod(projectId, periodId),
    onSuccess: (_variables, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}


export function useSeedBudgetFromEstimate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, ...body }: SeedBudgetInput & { projectId: string }) => budgetApi.seedFromEstimate(projectId, body),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.detail(projectId) });
    },
  });
}
