import type { Knex } from "knex";

type Query = () => PromiseLike<unknown>;

/**
 * Runs independent queries in parallel on the pool, but one at a time inside a transaction:
 * a transaction owns a single connection, and pg queues overlapping queries on it today and
 * throws in pg 9 ("Calling client.query() when the client is already executing a query").
 */
export async function runQueries<T extends readonly Query[]>(db: Knex, queries: readonly [...T]): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  type Results = { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
  if (!db.isTransaction) return await Promise.all(queries.map((query) => query())) as Results;
  const results: unknown[] = [];
  for (const query of queries) results.push(await query());
  return results as Results;
}
