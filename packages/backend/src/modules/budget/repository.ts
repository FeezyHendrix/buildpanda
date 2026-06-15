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

    async allocationDeltas(projectId: string): Promise<CategoryAllocationDeltaRow[]> {
      const [approvedCr, submittedCr, committedCr, paidInvoices] = await Promise.all([
        db("change_request_budget_links as l")
          .join("change_requests as c", "c.id", "l.change_request_id")
          .where("c.project_id", projectId)
          .where("c.status", "Approved")
          .groupBy("l.budget_category_id")
          .select("l.budget_category_id")
          .sum<{ budget_category_id: string; sum: string }[]>("l.amount as sum"),
        db("change_request_budget_links as l")
          .join("change_requests as c", "c.id", "l.change_request_id")
          .where("c.project_id", projectId)
          .where("c.status", "Submitted")
          .groupBy("l.budget_category_id")
          .select("l.budget_category_id")
          .sum<{ budget_category_id: string; sum: string }[]>("l.amount as sum"),
        db("change_request_budget_links as l")
          .join("change_requests as c", "c.id", "l.change_request_id")
          .where("c.project_id", projectId)
          .where("c.status", "Approved")
          .where("l.committed", true)
          .groupBy("l.budget_category_id")
          .select("l.budget_category_id")
          .sum<{ budget_category_id: string; sum: string }[]>("l.amount as sum"),
        db("invoice_budget_allocations as a")
          .join("project_invoices as i", "i.id", "a.invoice_id")
          .where("i.project_id", projectId)
          .where("i.status", "Paid")
          .groupBy("a.budget_category_id")
          .select("a.budget_category_id")
          .sum<{ budget_category_id: string; sum: string }[]>("a.amount as sum"),
      ]);

      const deltas = new Map<string, CategoryAllocationDeltaRow>();
      const ensure = (id: string): CategoryAllocationDeltaRow => {
        let d = deltas.get(id);
        if (!d) {
          d = {
            budget_category_id: id,
            approved_change: 0,
            submitted_change: 0,
            committed_change: 0,
            paid_invoice: 0,
          };
          deltas.set(id, d);
        }
        return d;
      };
      for (const r of approvedCr) ensure(r.budget_category_id).approved_change = Number(r.sum);
      for (const r of submittedCr) ensure(r.budget_category_id).submitted_change = Number(r.sum);
      for (const r of committedCr) ensure(r.budget_category_id).committed_change = Number(r.sum);
      for (const r of paidInvoices) ensure(r.budget_category_id).paid_invoice = Number(r.sum);
      return [...deltas.values()];
    },
  };
}

export interface CategoryAllocationDeltaRow {
  budget_category_id: string;
  approved_change: number;
  submitted_change: number;
  committed_change: number;
  paid_invoice: number;
}

export type BudgetRepository = ReturnType<typeof budgetRepository>;
