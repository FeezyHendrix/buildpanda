import api from "./client";
import type {
  Transaction,
  TransactionCategoryInfo,
  TransactionAnalytics,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateCustomCategoryInput,
  TransactionListFilters,
} from "@/lib/project-types";

export const transactionsApi = {
  list: (projectId: string, filters?: TransactionListFilters) =>
    api.get<Transaction[]>(`/projects/${projectId}/transactions`, { params: filters }).then((r) => r.data),

  create: (projectId: string, body: CreateTransactionInput) =>
    api.post<Transaction>(`/projects/${projectId}/transactions`, body).then((r) => r.data),

  update: (projectId: string, transactionId: string, body: UpdateTransactionInput) =>
    api.put<Transaction>(`/projects/${projectId}/transactions/${transactionId}`, body).then((r) => r.data),

  delete: (projectId: string, transactionId: string) =>
    api.delete(`/projects/${projectId}/transactions/${transactionId}`).then((r) => r.data),

  analytics: (projectId: string, filters?: TransactionListFilters) =>
    api.get<TransactionAnalytics>(`/projects/${projectId}/transactions/analytics`, { params: filters }).then((r) => r.data),

  categories: (projectId: string) =>
    api.get<TransactionCategoryInfo[]>(`/projects/${projectId}/transactions/categories`).then((r) => r.data),

  createCategory: (projectId: string, body: CreateCustomCategoryInput) =>
    api.post<TransactionCategoryInfo>(`/projects/${projectId}/transactions/categories`, body).then((r) => r.data),

  deleteCategory: (projectId: string, categoryId: string) =>
    api.delete(`/projects/${projectId}/transactions/categories/${categoryId}`).then((r) => r.data),

  getExportUrl: (projectId: string, filters?: TransactionListFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append("category", filters.category);
    if (filters?.from) params.append("from", filters.from);
    if (filters?.to) params.append("to", filters.to);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return `${api.defaults.baseURL}/projects/${projectId}/transactions/export.csv${qs ? `?${qs}` : ""}`;
  },
};
