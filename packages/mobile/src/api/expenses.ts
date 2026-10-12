import { request } from "./client";

/** One expense on the project's cost log: a record of money spent elsewhere. */
export interface Expense {
  id: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  amount: number;
  transactedAt: string;
  vendor: string | null;
  receiptFileId: string | null;
  stageId: string | null;
  stageName: string | null;
  credit: boolean;
  createdByName: string | null;
}

export interface ExpenseCategory {
  key: string;
  label: string;
}

export interface CreateExpenseInput {
  title: string;
  category: string;
  amount: number;
  transactedAt: string;
  description?: string | null;
  vendor?: string | null;
  receiptFileId?: string | null;
  stageId?: string | null;
  credit?: boolean;
}

export const expensesApi = {
  list: (projectId: string) => request<Expense[]>(`/projects/${projectId}/transactions`),

  categories: (projectId: string) => request<ExpenseCategory[]>(`/projects/${projectId}/transactions/categories`),

  create: (projectId: string, body: CreateExpenseInput) =>
    request<Expense>(`/projects/${projectId}/transactions`, { method: "POST", body: JSON.stringify(body) }),
};
