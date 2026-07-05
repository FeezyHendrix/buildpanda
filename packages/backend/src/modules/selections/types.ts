import type { CurrencyCode } from "../../lib/currencies.ts";

export const SELECTION_STATUSES = ["open", "decided", "cancelled"] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export type Currency = CurrencyCode;

export interface SelectionOption {
  id: string;
  selectionId: string;
  name: string;
  description: string | null;
  price: number | null;
  sortOrder: number;
}

export interface Selection {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  category: string | null;
  allowanceAmount: number | null;
  currency: Currency;
  dueDate: string | null;
  status: SelectionStatus;
  chosenOptionId: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  changeRequestId: string | null;
  createdById: string | null;
  /** Chosen option price minus allowance when both are present (min 0); null otherwise. */
  overage: number | null;
  options: SelectionOption[];
  createdAt: string;
  updatedAt: string;
}

export interface SelectionRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string | null;
  allowance_amount: string | null;
  currency: Currency;
  due_date: string | null;
  status: SelectionStatus;
  chosen_option_id: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  change_request_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelectionOptionRow {
  id: string;
  selection_id: string;
  name: string;
  description: string | null;
  price: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
