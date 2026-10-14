

export type TransactionCategoryType = "preset" | "custom";

export interface Transaction {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  categoryColor: string | null;
  categoryType: TransactionCategoryType;
  amount: number;
  transactedAt: string;
  vendor: string | null;
  reference: string | null;
  receiptFileId: string | null;
  stageId: string | null;
  stageName: string | null;
  /** A refund or credit note against this category, not an outlay. */
  credit: boolean;
  /** A refundable outlay — a plant-hire deposit, a bond — not final cost. */
  recoverable: boolean;
  /** Dated before the project started: legitimate, but not recoverable under the contract. */
  preContract: boolean;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCategoryInfo {
  key: string;
  label: string;
  color: string | null;
  type: TransactionCategoryType;
  categoryId: string | null;
}

export interface TransactionAnalyticsCategory {
  key: string;
  label: string;
  color: string | null;
  type: TransactionCategoryType;
  total: number;
  count: number;
}

export interface TransactionAnalyticsMonth {
  month: string;
  total: number;
}

export interface TransactionAnalytics {
  totalAmount: number;
  count: number;
  byCategory: TransactionAnalyticsCategory[];
  byMonth: TransactionAnalyticsMonth[];
}

export interface TransactionListFilters {
  category?: string;
  stageId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CreateTransactionInput {
  title: string;
  description?: string | null;
  category: string;
  amount: number;
  transactedAt: string;
  vendor?: string | null;
  reference?: string | null;
  receiptFileId?: string | null;
  stageId?: string | null;
  credit?: boolean;
  recoverable?: boolean;
}

export interface UpdateTransactionInput {
  title?: string;
  description?: string | null;
  category?: string;
  amount?: number;
  transactedAt?: string;
  vendor?: string | null;
  reference?: string | null;
  receiptFileId?: string | null;
  stageId?: string | null;
  credit?: boolean;
  recoverable?: boolean;
}

export interface CreateCustomCategoryInput {
  label: string;
  color?: string | null;
}
