// What "bound to a transaction" means for the estimate repositories.
//
// An estimate's priced lines and its denormalized totals are one fact split
// across two tables. Replacing the lines and then recalculating the totals on
// separate connections leaves a window in which the estimate shows a subtotal
// for items that no longer exist — and if the second write fails, that window
// never closes. So both must run on the SAME transaction, under the SAME lock
// on the estimate row.
//
// Postgres will happily accept `SELECT ... FOR UPDATE` outside an explicit
// transaction: it wraps the statement in its own, takes the lock and releases
// it before the next statement runs. The caller believes it holds the estimate
// and it holds nothing. That failure is silent and would only show up as a lost
// update under load, so these helpers refuse the call instead.

import type { Knex } from "knex";

/** A connection or a transaction; the repositories read through either. */
export type EstimateDb = Knex | Knex.Transaction;

function isTransaction(db: EstimateDb): db is Knex.Transaction {
  return (db as Knex.Transaction).isTransaction === true;
}

/**
 * Refuses a write or a row lock that is not running inside a transaction.
 * `operation` names the caller so the failure points at the composition root
 * that forgot to open one, not at the repository.
 */
export function assertTransaction(db: EstimateDb, operation: string): Knex.Transaction {
  if (!isTransaction(db)) {
    throw new Error(
      `${operation} must run inside a transaction: it either locks the estimate row or writes ` +
        `items and totals together. Compose it through estimateItemsService.withEstimateLock().`,
    );
  }
  return db;
}
