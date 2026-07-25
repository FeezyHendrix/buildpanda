export const PRESET_TRANSACTION_CATEGORIES = [
  { key: "materials", label: "Materials", color: "#EA580C" },
  { key: "labour", label: "Labour", color: "#0EA5E9" },
  { key: "equipment", label: "Equipment / Plant", color: "#8B5CF6" },
  { key: "subcontractor", label: "Subcontractor", color: "#F59E0B" },
  { key: "transport", label: "Transport & Logistics", color: "#06B6D4" },
  { key: "permits_fees", label: "Permits & Fees", color: "#EF4444" },
  { key: "utilities", label: "Utilities", color: "#10B981" },
  { key: "professional_services", label: "Professional Services", color: "#6366F1" },
  { key: "preliminaries", label: "Preliminaries", color: "#84CC16" },
  { key: "overhead", label: "Overhead", color: "#78716C" },
  { key: "miscellaneous", label: "Miscellaneous", color: "#94A3B8" },
] as const;

export type PresetCategoryKey =
  (typeof PRESET_TRANSACTION_CATEGORIES)[number]["key"];

export const PRESET_CATEGORY_KEYS = PRESET_TRANSACTION_CATEGORIES.map(
  (c) => c.key,
) as readonly PresetCategoryKey[];

export type CategoryType = "preset" | "custom";

export interface TransactionRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string;
  category_type: CategoryType;
  amount: string;
  transacted_at: string;
  vendor: string | null;
  reference: string | null;
  receipt_file_id: string | null;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TransactionRowWithUser extends TransactionRow {
  created_by_name: string | null;
}

export interface CustomCategoryRow {
  id: string;
  org_id: string;
  label: string;
  color: string | null;
  created_by_id: string | null;
  created_at: Date | string;
}

export interface Transaction {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string;
  categoryLabel: string;
  categoryColor: string | null;
  categoryType: CategoryType;
  amount: number;
  transactedAt: string;
  vendor: string | null;
  reference: string | null;
  receiptFileId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTransactionCategory {
  id: string;
  orgId: string;
  label: string;
  color: string | null;
  createdAt: string;
}

export interface TransactionCategoryInfo {
  key: string;
  label: string;
  color: string | null;
  type: CategoryType;
  categoryId: string | null;
}

export interface TransactionAnalyticsByCategory {
  key: string;
  label: string;
  color: string | null;
  type: CategoryType;
  total: number;
  count: number;
}

export interface TransactionAnalyticsByMonth {
  month: string;
  total: number;
}

export interface TransactionAnalytics {
  totalAmount: number;
  count: number;
  byCategory: TransactionAnalyticsByCategory[];
  byMonth: TransactionAnalyticsByMonth[];
}

export interface TransactionListFilters {
  category?: string;
  from?: string;
  to?: string;
  search?: string;
}
