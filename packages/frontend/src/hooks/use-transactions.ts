import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsApi } from "@/api/transactions";
import { transactionKeys } from "./query-keys";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateCustomCategoryInput,
  TransactionListFilters,
} from "@/lib/project-types";

export function useTransactions(projectId: string, filters?: TransactionListFilters) {
  return useQuery({
    queryKey: transactionKeys.list(projectId, filters),
    queryFn: () => transactionsApi.list(projectId, filters),
    enabled: Boolean(projectId),
  });
}

export function useTransactionAnalytics(projectId: string, filters?: TransactionListFilters) {
  return useQuery({
    queryKey: [...transactionKeys.analytics(projectId), filters] as const,
    queryFn: () => transactionsApi.analytics(projectId, filters),
    enabled: Boolean(projectId),
  });
}

export function useTransactionCategories(projectId: string) {
  return useQuery({
    queryKey: transactionKeys.categories(projectId),
    queryFn: () => transactionsApi.categories(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateTransaction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTransactionInput) => transactionsApi.create(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all(projectId) });
    },
  });
}

export function useUpdateTransaction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, body }: { transactionId: string; body: UpdateTransactionInput }) =>
      transactionsApi.update(projectId, transactionId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all(projectId) });
    },
  });
}

export function useDeleteTransaction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => transactionsApi.delete(projectId, transactionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all(projectId) });
    },
  });
}

export function useCreateTransactionCategory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomCategoryInput) => transactionsApi.createCategory(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.categories(projectId) });
    },
  });
}

export function useDeleteTransactionCategory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => transactionsApi.deleteCategory(projectId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.categories(projectId) });
      qc.invalidateQueries({ queryKey: transactionKeys.list(projectId) });
      qc.invalidateQueries({ queryKey: transactionKeys.analytics(projectId) });
    },
  });
}

export function useExportTransactionsCsv() {
  return useMutation({
    mutationFn: async ({ projectId, filters }: { projectId: string; filters?: TransactionListFilters }) => {
      const url = transactionsApi.getExportUrl(projectId, filters);
      window.open(url, "_blank");
    },
  });
}
