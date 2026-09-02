import { and, eq } from "drizzle-orm";
import { outbox } from "./schema";

type Tx = {
  select: (fields: { id: typeof outbox.id }) => {
    from: (table: typeof outbox) => {
      where: (condition: unknown) => { limit: (n: number) => Promise<{ id: string }[]> };
    };
  };
  insert: (table: typeof outbox) => { values: (row: Record<string, unknown>) => Promise<unknown> };
};

async function hasQueued(tx: Tx, resource: string, entityId: string, operation: string) {
  const [row] = await tx
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(eq(outbox.resource, resource), eq(outbox.entityId, entityId), eq(outbox.operation, operation)),
    )
    .limit(1);
  return Boolean(row);
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
  if (await hasQueued(tx, resource, entityId, "create")) return;
  if (await hasQueued(tx, resource, entityId, "update")) return;

  await tx.insert(outbox).values({
    id: newId,
    resource,
    entityId,
    projectId,
    operation: "update",
    nextAttemptAt: 0,
  });
}
