import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateLookAheadInput, LookAhead } from "@/api/look-aheads";
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
