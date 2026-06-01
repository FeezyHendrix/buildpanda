import type { Knex } from "knex";
import type { BudgetCategoryRow, BudgetPeriodRow } from "./types.ts";

export interface NewCategoryRecord {
  id: string;
  project_id: string;
  name: string;
  cost_code: string | null;
  planned: string;
  committed: string;
  actual: string;
  notes: string | null;
  sort_order: number;
}

export interface CategoryUpdatePatch {
  name?: string;
  cost_code?: string | null;
  planned?: string;
  committed?: string;
  actual?: string;
  notes?: string | null;
  sort_order?: number;
}

export interface NewPeriodRecord {
  id: string;
  project_id: string;
  period: string;
  planned: string;
  actual: string;
  notes: string | null;
}

export interface PeriodUpdatePatch {
  period?: string;
  planned?: string;
  actual?: string;
  notes?: string | null;
}

export function budgetRepository(db: Knex) {
  return {
    listCategories(projectId: string): Promise<BudgetCategoryRow[]> {
      return db<BudgetCategoryRow>("project_budget_categories")
        .where({ project_id: projectId })
        .orderBy([
          { column: "sort_order", order: "asc" },
          { column: "created_at", order: "asc" },
        ]);
    },

    findCategory(id: string): Promise<BudgetCategoryRow | undefined> {
      return db<BudgetCategoryRow>("project_budget_categories")
        .where({ id })
        .first();
    },

    maxCategorySortOrder(projectId: string): Promise<number | null> {
      return db<BudgetCategoryRow>("project_budget_categories")
        .where({ project_id: projectId })
        .max<{ max: number | null }>("sort_order as max")
        .first()
        .then((row) => row?.max ?? null);
    },

    async createCategory(
      record: NewCategoryRecord,
    ): Promise<BudgetCategoryRow> {
      const [row] = await db<BudgetCategoryRow>("project_budget_categories")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert budget category");
      return row;
    },

    async updateCategory(
      id: string,
      patch: CategoryUpdatePatch,
    ): Promise<BudgetCategoryRow | undefined> {
      const [row] = await db<BudgetCategoryRow>("project_budget_categories")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteCategory(id: string): Promise<number> {
      return db("project_budget_categories").where({ id }).delete();
    },

    listPeriods(projectId: string): Promise<BudgetPeriodRow[]> {
      return db<BudgetPeriodRow>("project_budget_periods")
        .where({ project_id: projectId })
        .orderBy("period", "asc");
    },

    findPeriod(id: string): Promise<BudgetPeriodRow | undefined> {
      return db<BudgetPeriodRow>("project_budget_periods").where({ id }).first();
    },

    findPeriodByValue(
      projectId: string,
      period: string,
    ): Promise<BudgetPeriodRow | undefined> {
      return db<BudgetPeriodRow>("project_budget_periods")
        .where({ project_id: projectId, period })
        .first();
    },

    async createPeriod(record: NewPeriodRecord): Promise<BudgetPeriodRow> {
      const [row] = await db<BudgetPeriodRow>("project_budget_periods")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert budget period");
      return row;
    },

    async updatePeriod(
      id: string,
      patch: PeriodUpdatePatch,
    ): Promise<BudgetPeriodRow | undefined> {
      const [row] = await db<BudgetPeriodRow>("project_budget_periods")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deletePeriod(id: string): Promise<number> {
      return db("project_budget_periods").where({ id }).delete();
    },
  };
}

export type BudgetRepository = ReturnType<typeof budgetRepository>;
