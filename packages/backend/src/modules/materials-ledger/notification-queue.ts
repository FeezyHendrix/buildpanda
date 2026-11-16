import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { logger } from "../../lib/logger.ts";

const completions = new WeakMap<Knex.Transaction, Promise<boolean>>();

function transactionCommitted(transaction: Knex.Transaction): Promise<boolean> {
  const existing = completions.get(transaction);
  if (existing) return existing;
  let committed = false;
  const query = (value: Knex.Sql) => {
    if (/^\s*(COMMIT\b|RELEASE SAVEPOINT\b)/i.test(value.sql)) committed = true;
    else if (/^\s*ROLLBACK\b/i.test(value.sql)) committed = false;
  };
  transaction.on("query", query);
  // Explicit rollback() can resolve executionPromise; its SQL boundary distinguishes it from commit.
  const completed = transaction.executionPromise.then(() => committed, () => false)
    .finally(() => transaction.removeListener("query", query));
  completions.set(transaction, completed);
  return completed;
}

/** Side effects must wait for every enclosing transaction, including savepoints. */
export function afterCommit(db: Knex, operation: () => Promise<unknown>): void {
  const ancestors: Promise<boolean>[] = [];
  if (db.isTransaction) {
    for (let transaction: Knex.Transaction | undefined = db as Knex.Transaction; transaction; transaction = transaction.parentTransaction) {
      ancestors.push(transactionCommitted(transaction));
    }
  }
  void Promise.all(ancestors).then((committed) => committed.every(Boolean) ? operation() : undefined)
    .catch(() => logger.error("A post-commit side effect failed"));
}

/** Email/push must never describe a material movement whose enclosing action rolled back. */
export function materialLedgerNotificationQueue(db: Knex, queue?: Pick<QueueManager, "enqueue">): Pick<QueueManager, "enqueue"> | undefined {
  if (!queue || !db.isTransaction) return queue;
  return {
    async enqueue(...args: Parameters<QueueManager["enqueue"]>) {
      // Return before commit; waiting here would deadlock the transaction that awaits notify().
      afterCommit(db, () => queue.enqueue(...args));
    },
  };
}
