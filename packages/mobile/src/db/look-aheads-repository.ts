import { randomUUID } from "expo-crypto";
import { and, desc, eq } from "drizzle-orm";
import type { CreateLookAheadInput, LookAhead, UpdateLookAheadInput } from "@/api/look-aheads";
import type { Db } from "./client";
import { lookAheads, outbox, type LookAheadRow } from "./schema";

export function toLookAhead(row: LookAheadRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    totalWorkers: row.totalWorkers,
    isPendingSync: row.isPendingSync,
  };
}

export const lookAheadsRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(lookAheads)
      .where(eq(lookAheads.projectId, projectId))
      .orderBy(desc(lookAheads.updatedAt)),

  async createLocal(db: Db, projectId: string, input: CreateLookAheadInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(lookAheads).values({
        id,
        projectId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        totalWorkers: input.totalWorkers ?? null,
        buildingId: input.buildingId ?? null,
        isPendingSync: true,
        updatedAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "look-aheads",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  /**
   * Applies an edit locally and queues the push in one transaction.
   *
   * A record whose create is still queued has an id the server has never seen,
   * so no update is enqueued for it — the local row is mutated and the pending
   * create carries the final state. Enqueuing one would PATCH a nonexistent id.
   */
  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(lookAheads).set({ isPendingSync: false }).where(eq(lookAheads.id, id));
  },

  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: UpdateLookAheadInput,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(lookAheads)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
          ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
          ...(patch.totalWorkers !== undefined ? { totalWorkers: patch.totalWorkers } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(lookAheads.id, id));

      const [queuedCreate] = await tx
        .select({ id: outbox.id })
        .from(outbox)
        .where(
          and(
            eq(outbox.resource, "look-aheads"),
            eq(outbox.entityId, id),
            eq(outbox.operation, "create"),
          ),
        )
        .limit(1);
      if (queuedCreate) return;

      const [queuedUpdate] = await tx
        .select({ id: outbox.id })
        .from(outbox)
        .where(
          and(
            eq(outbox.resource, "look-aheads"),
            eq(outbox.entityId, id),
            eq(outbox.operation, "update"),
          ),
        )
        .limit(1);
      if (queuedUpdate) return;

      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "look-aheads",
        entityId: id,
        projectId,
        operation: "update",
        nextAttemptAt: 0,
      });
    });
  },

  async reconcileCreate(db: Db, projectId: string, localId: string, server: LookAhead) {
    await db.transaction(async (tx) => {
      await tx.delete(lookAheads).where(eq(lookAheads.id, localId));
      await tx.insert(lookAheads).values({
        id: server.id,
        projectId,
        name: server.name,
        description: server.description,
        status: server.status,
        startDate: server.startDate,
        endDate: server.endDate,
        totalWorkers: server.totalWorkers,
        isPendingSync: false,
        updatedAt: Date.now(),
      });
    });
  },

  async upsertFromServer(db: Db, projectId: string, rows: readonly LookAhead[]) {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(lookAheads)
          .values({
            id: row.id,
            projectId,
            name: row.name,
            description: row.description,
            status: row.status,
            startDate: row.startDate,
            endDate: row.endDate,
            totalWorkers: row.totalWorkers,
            isPendingSync: false,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: lookAheads.id,
            set: {
              name: row.name,
              description: row.description,
              status: row.status,
              startDate: row.startDate,
              endDate: row.endDate,
              totalWorkers: row.totalWorkers,
              updatedAt: now,
            },
            where: eq(lookAheads.isPendingSync, false),
          });
      }
    });
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(lookAheads).where(eq(lookAheads.id, id)).limit(1);
    return row;
  },
};
