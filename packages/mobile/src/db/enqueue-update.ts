import { and, eq } from "drizzle-orm";
import { outbox } from "./schema";

type Tx = {
  select: (fields: { id: typeof outbox.id; status: typeof outbox.status }) => {
    from: (table: typeof outbox) => {
      where: (condition: unknown) => { limit: (n: number) => Promise<{ id: string; status: string }[]> };
    };
  };
  insert: (table: typeof outbox) => { values: (row: Record<string, unknown>) => Promise<unknown> };
  update: (table: typeof outbox) => {
    set: (values: Record<string, unknown>) => { where: (condition: unknown) => Promise<unknown> };
  };
  delete: (table: typeof outbox) => { where: (condition: unknown) => Promise<unknown> };
};

async function findQueued(tx: Tx, resource: string, entityId: string, operation: string) {
  const [row] = await tx
    .select({ id: outbox.id, status: outbox.status })
    .from(outbox)
    .where(
      and(eq(outbox.resource, resource), eq(outbox.entityId, entityId), eq(outbox.operation, operation)),
    )
    .limit(1);
  return row ?? null;
}

async function revive(tx: Tx, id: string): Promise<void> {
  await tx
    .update(outbox)
    .set({ status: "pending", attempts: 0, nextAttemptAt: 0, lastError: null })
    .where(eq(outbox.id, id));
}

/**
 * Queues one push per record and operation, in the caller's transaction.
 *
 * A row that already failed is revived rather than left dead beside a fresh
 * one: the local record carries the crew member's newest edit, so sending it
 * again is exactly what they asked for. A row still pending is left alone —
 * it will read the same local state when it runs.
 */
export async function reviveOrQueue(
  tx: Tx,
  row: { resource: string; entityId: string; projectId: string; operation: string; newId: string },
): Promise<void> {
  const existing = await findQueued(tx, row.resource, row.entityId, row.operation);
  if (existing) {
    if (existing.status === "failed") await revive(tx, existing.id);
    return;
  }
  await tx.insert(outbox).values({
    id: row.newId,
    resource: row.resource,
    entityId: row.entityId,
    projectId: row.projectId,
    operation: row.operation,
    nextAttemptAt: 0,
  });
}

/**
 * Queues an edit for push, in the caller's transaction.
 *
 * Returns without queuing when the record's create is still pending: its id has
 * never reached the server, so an update would PATCH something that does not
 * exist — the queued create carries the newer local state instead. A second
 * edit coalesces onto the update already queued rather than stacking rows.
 *
 * Shared so this rule has one home; duplicating it per repository is how one
 * copy quietly loses the guard. The row id is passed in rather than generated
 * here, so this stays free of native modules and can be tested directly.
 */
export async function enqueueUpdate(
  tx: Tx,
  resource: string,
  entityId: string,
  projectId: string,
  newId: string,
): Promise<void> {
  const create = await findQueued(tx, resource, entityId, "create");
  if (create) {
    if (create.status === "failed") await revive(tx, create.id);
    return;
  }
  await reviveOrQueue(tx, { resource, entityId, projectId, operation: "update", newId });
}

/**
 * Queues a delete for push, in the caller's transaction.
 *
 * Any work already queued for the record is dropped first: an update to a row
 * that is about to disappear is pointless. If its create never left the device
 * then the server has no such record, so nothing is queued at all — pushing a
 * delete for an id the server has never seen would 404.
 */
export async function enqueueDelete(
  tx: Tx,
  resource: string,
  entityId: string,
  projectId: string,
  newId: string,
): Promise<void> {
  const neverReachedServer = (await findQueued(tx, resource, entityId, "create")) !== null;

  await tx
    .delete(outbox)
    .where(and(eq(outbox.resource, resource), eq(outbox.entityId, entityId)));

  if (neverReachedServer) return;

  await tx.insert(outbox).values({
    id: newId,
    resource,
    entityId,
    projectId,
    operation: "delete",
    nextAttemptAt: 0,
  });
}
