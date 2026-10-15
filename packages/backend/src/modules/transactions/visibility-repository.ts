import type { Knex } from "knex";

/** Undefined means explicitly unrestricted; null denies reads without a caller. */
export function applyExpenseVisibility(query: Knex.QueryBuilder, readerId: string | null | undefined, alias = "project_transactions") {
  if (readerId === null) return query.whereRaw("false");
  if (readerId !== undefined) query.where(`${alias}.created_by_id`, readerId);
  return query;
}
