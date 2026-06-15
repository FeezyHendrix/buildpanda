export interface BudgetCategory {
  id: string;
  name: string;
  costCode: string | null;
  planned: number;
  committed: number;
  actual: number;
  notes: string | null;
  variance: number;
  variancePercentage: number;
  remaining: number;
  percentSpent: number;
  effectivePlanned: number;
  projectedPlanned: number;
  effectiveCommitted: number;
  effectiveActual: number;
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

export interface BudgetCategoryRow {
  id: string;
  project_id: string;
  name: string;
  cost_code: string | null;
  planned: string;
  committed: string;
  actual: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface BudgetPeriodRow {
  id: string;
  project_id: string;
  period: string;
  planned: string;
  actual: string;
  notes: string | null;
  created_at: string;
}
