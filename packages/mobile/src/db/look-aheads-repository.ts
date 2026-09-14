import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { CreateLookAheadInput, LookAhead, UpdateLookAheadInput } from "@/api/look-aheads";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate } from "./enqueue-update";
import { lookAheads, outbox, type LookAheadRow } from "./schema";

/**
 * What a screen edits locally: the full list of assigned activities. The
 * outbox turns it into the server's assign/unassign deltas on push.
 */
export type LookAheadPatch = Omit<UpdateLookAheadInput, "assignActivityIds" | "unassignActivityIds"> & {
  activityIds?: string[];
};

/** The column is a JSON array; a row written by an older build may hold junk. */
export function parseActivityIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function serverActivityIds(server: LookAhead): string {
  return JSON.stringify((server.activities ?? []).map((activity) => activity.activityId));
}

export function toLookAhead(row: LookAheadRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    totalWorkers: row.totalWorkers,
    activityIds: parseActivityIds(row.activityIds),
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

  /** One row for a detail or edit screen; re-runs only when that row changes. */
  byIdQuery: (db: Db, id: string) =>
    db.select().from(lookAheads).where(eq(lookAheads.id, id)).limit(1),

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
        activityIds: JSON.stringify(input.activityIds ?? []),
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

  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(lookAheads).set({ isPendingSync: false }).where(eq(lookAheads.id, id));
  },

  /** Removes the row locally and queues the push in one transaction. */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(lookAheads).where(eq(lookAheads.id, id));
      await enqueueDelete(tx as never, "look-aheads", id, projectId, randomUUID());
    });
  },

  /** Applies an edit locally and queues the push in one transaction. */
  async updateLocal(db: Db, projectId: string, id: string, patch: LookAheadPatch): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(lookAheads)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
          ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
          ...(patch.totalWorkers !== undefined ? { totalWorkers: patch.totalWorkers } : {}),
          ...(patch.activityIds !== undefined ? { activityIds: JSON.stringify(patch.activityIds) } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(lookAheads.id, id));

      await enqueueUpdate(tx as never, "look-aheads", id, projectId, randomUUID());
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
        activityIds: serverActivityIds(server),
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
            activityIds: serverActivityIds(row),
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
              activityIds: serverActivityIds(row),
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
