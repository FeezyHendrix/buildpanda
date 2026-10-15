import type { Knex } from "knex";
import { applyExpenseVisibility } from "../../transactions/visibility-repository.ts";

export function expensesAgentRepository(db: Knex, readerId: string | null | undefined) {
  return {
    finances(projectId: string) {
      return db("project_finances").where({ project_id: projectId }).first();
    },

    stageNames(projectId: string): Promise<Array<{ id: string; name: string }>> {
      return db("project_phases")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name");
    },

    financeEvents(projectId: string) {
      return db("finance_events")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(100)
        .select("type", "actor_name", "summary", "amount", "created_at");
    },

    transactions(projectId: string, filters: { category?: string; from?: string; to?: string; limit?: number }) {
      const query = db("project_transactions")
        .modify((query) => applyExpenseVisibility(query, readerId))
        .where({ project_id: projectId })
        .orderBy("transacted_at", "desc")
        .limit(filters.limit ?? 200)
        .select(
          "id",
          "title",
          "description",
          "category",
          "category_type",
          "amount",
          "transacted_at",
          "vendor",
          "reference",
          "created_at",
        );
      if (filters.category) query.where("category", filters.category);
      if (filters.from) query.where("transacted_at", ">=", filters.from);
      if (filters.to) query.where("transacted_at", "<=", filters.to);
      return query;
    },

    transactionTotalsByCategory(projectId: string, filters: { from?: string; to?: string }) {
      const query = db("project_transactions")
        .modify((query) => applyExpenseVisibility(query, readerId))
        .where({ project_id: projectId })
        .groupBy("category")
        .orderBy(db.raw("SUM(amount)"), "desc")
        .select("category")
        .sum({ total: "amount" })
        .count({ count: "id" });
      if (filters.from) query.where("transacted_at", ">=", filters.from);
      if (filters.to) query.where("transacted_at", "<=", filters.to);
      return query;
    },

    budgetCategories(projectId: string) {
      return db("project_budget_categories")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "cost_code", "planned", "committed", "actual");
    },

    purchaseOrders(projectId: string) {
      // One query: POs with their total aggregated from line items.
      return db("purchase_orders as po")
        .leftJoin("purchase_order_items as it", "it.purchase_order_id", "po.id")
        .where("po.project_id", projectId)
        .groupBy("po.id")
        .orderBy("po.created_at", "desc")
        .limit(100)
        .select(
          "po.id",
          "po.po_number",
          "po.vendor_name",
          "po.status",
          "po.order_date",
          "po.expected_date",
          db.raw("coalesce(sum(it.quantity * it.unit_price), 0) as total"),
        );
    },

    transactionCategoryAnalytics(projectId: string) {
      return db("project_transactions as t")
        .modify((query) => applyExpenseVisibility(query, readerId, "t"))
        .where("t.project_id", projectId)
        .groupBy("t.category")
        .orderByRaw("SUM(t.amount) DESC")
        .select<{ category_name: string; total: string; count: string }[]>("t.category as category_name", db.raw("COALESCE(SUM(t.amount), 0) as total"), db.raw("COUNT(t.id) as count"));
    },

    transactionRecent(projectId: string, limit: number) {
      return db("project_transactions as t")
        .modify((query) => applyExpenseVisibility(query, readerId, "t"))
        .where("t.project_id", projectId)
        .orderBy("t.created_at", "desc")
        .limit(limit)
        .select<{ id: string; title: string; amount: string; category_name: string; transaction_date: string }[]>("t.id", "t.title", "t.amount", "t.category as category_name", "t.transacted_at as transaction_date");
    },

    transactionTotal(projectId: string): Promise<number> {
      return db("project_transactions")
        .modify((query) => applyExpenseVisibility(query, readerId))
        .where({ project_id: projectId })
        .sum<{ total: string | null }[]>("amount as total")
        .first()
        .then((r) => Number(r?.total ?? 0));
    },
  };
}
