import type { Knex } from "knex";
import type {
  CategoryType,
  CustomCategoryRow,
  TransactionListFilters,
  TransactionRow,
  TransactionRowWithUser,
} from "./types.ts";

export interface NewTransactionRecord {
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
}

export interface TransactionUpdatePatch {
  title?: string;
  description?: string | null;
  category?: string;
  category_type?: CategoryType;
  amount?: string;
  transacted_at?: string;
  vendor?: string | null;
  reference?: string | null;
  receipt_file_id?: string | null;
  updated_at?: Date | string;
}

export interface NewCustomCategoryRecord {
  id: string;
  org_id: string;
  label: string;
  color: string | null;
  created_by_id: string | null;
}

function applyFilters(
  builder: Knex.QueryBuilder,
  filters: TransactionListFilters | undefined,
): Knex.QueryBuilder {
  if (!filters) return builder;
  if (filters.category) {
    builder.where("project_transactions.category", filters.category);
  }
  if (filters.from) {
    builder.where("project_transactions.transacted_at", ">=", filters.from);
  }
  if (filters.to) {
    builder.where("project_transactions.transacted_at", "<=", filters.to);
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    builder.where((qb) => {
      qb.whereRaw("LOWER(project_transactions.title) LIKE ?", [term])
        .orWhereRaw("LOWER(project_transactions.description) LIKE ?", [term])
        .orWhereRaw("LOWER(project_transactions.vendor) LIKE ?", [term])
        .orWhereRaw("LOWER(project_transactions.reference) LIKE ?", [term]);
    });
  }
  return builder;
}

export function transactionsRepository(db: Knex) {
  return {
    async listByProject(
      projectId: string,
      filters?: TransactionListFilters,
    ): Promise<TransactionRowWithUser[]> {
      const query = db<TransactionRow>("project_transactions")
        .select(
          "project_transactions.*",
          db.raw("\"user\".name as created_by_name"),
        )
        .leftJoin("user", "user.id", "project_transactions.created_by_id")
        .where("project_transactions.project_id", projectId)
        .orderBy("project_transactions.transacted_at", "desc")
        .orderBy("project_transactions.created_at", "desc");

      applyFilters(query, filters);
      return query as unknown as Promise<TransactionRowWithUser[]>;
    },

    async findById(id: string): Promise<TransactionRowWithUser | undefined> {
      const row = await db<TransactionRow>("project_transactions")
        .select(
          "project_transactions.*",
          db.raw("\"user\".name as created_by_name"),
        )
        .leftJoin("user", "user.id", "project_transactions.created_by_id")
        .where("project_transactions.id", id)
        .first();
      return row as TransactionRowWithUser | undefined;
    },

    async create(record: NewTransactionRecord): Promise<TransactionRow> {
      const [row] = await db<TransactionRow>("project_transactions")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert transaction");
      return row;
    },

    async update(
      id: string,
      patch: TransactionUpdatePatch,
    ): Promise<TransactionRow | undefined> {
      const [row] = await db<TransactionRow>("project_transactions")
        .where({ id })
        .update({ ...patch, updated_at: db.fn.now() })
        .returning("*");
      return row;
    },

    async remove(id: string): Promise<number> {
      return db("project_transactions").where({ id }).delete();
    },

    async aggregateByCategory(
      projectId: string,
      filters?: TransactionListFilters,
    ): Promise<Array<{ category: string; total: string; count: string }>> {
      const query = db<TransactionRow>("project_transactions")
        .select("category")
        .sum({ total: "amount" })
        .count({ count: "id" })
        .where("project_transactions.project_id", projectId)
        .groupBy("category");

      applyFilters(query, filters);
      return query as unknown as Promise<
        Array<{ category: string; total: string; count: string }>
      >;
    },

    async aggregateByMonth(
      projectId: string,
      filters?: TransactionListFilters,
    ): Promise<Array<{ month: string; total: string }>> {
      const query = db<TransactionRow>("project_transactions")
        .select(db.raw("to_char(transacted_at, 'YYYY-MM') as month"))
        .sum({ total: "amount" })
        .where("project_transactions.project_id", projectId)
        .groupByRaw("to_char(transacted_at, 'YYYY-MM')")
        .orderByRaw("to_char(transacted_at, 'YYYY-MM') asc");

      applyFilters(query, filters);
      return query as unknown as Promise<
        Array<{ month: string; total: string }>
      >;
    },

    async totals(
      projectId: string,
      filters?: TransactionListFilters,
    ): Promise<{ total: string | null; count: string }> {
      const query = db<TransactionRow>("project_transactions")
        .sum({ total: "amount" })
        .count({ count: "id" })
        .where("project_transactions.project_id", projectId)
        .first();

      applyFilters(query, filters);
      const row = (await query) as
        | { total: string | null; count: string }
        | undefined;
      return row ?? { total: null, count: "0" };
    },
  };
}

export type TransactionsRepository = ReturnType<typeof transactionsRepository>;

export function customCategoriesRepository(db: Knex) {
  return {
    listByOrg(orgId: string): Promise<CustomCategoryRow[]> {
      return db<CustomCategoryRow>("custom_transaction_categories")
        .where({ org_id: orgId })
        .orderByRaw("LOWER(label) asc");
    },

    findById(id: string): Promise<CustomCategoryRow | undefined> {
      return db<CustomCategoryRow>("custom_transaction_categories")
        .where({ id })
        .first();
    },

    findByLabel(
      orgId: string,
      label: string,
    ): Promise<CustomCategoryRow | undefined> {
      return db<CustomCategoryRow>("custom_transaction_categories")
        .where({ org_id: orgId })
        .whereRaw("LOWER(label) = LOWER(?)", [label])
        .first();
    },

    async create(record: NewCustomCategoryRecord): Promise<CustomCategoryRow> {
      const [row] = await db<CustomCategoryRow>("custom_transaction_categories")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert custom category");
      return row;
    },

    async remove(id: string): Promise<number> {
      return db("custom_transaction_categories").where({ id }).delete();
    },
  };
}

export type CustomCategoriesRepository = ReturnType<
  typeof customCategoriesRepository
>;
