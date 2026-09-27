import { remapQueuedRecord, isRecordSending } from "./sync-write-state";
import { randomUUID } from "expo-crypto";
import { and, desc, eq } from "drizzle-orm";
import type { CreateLookAheadInput, LookAhead, UpdateLookAheadInput } from "@/api/look-aheads";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate, reviveOrQueue } from "./enqueue-update";
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
    projectId: row.projectId,
    buildingId: row.buildingId,
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
  listQuery: (db: Db, projectId: string, buildingId?: string) =>
    db
      .select()
      .from(lookAheads)
      .where(and(eq(lookAheads.projectId, projectId), buildingId !== undefined ? eq(lookAheads.buildingId, buildingId) : undefined))
      .orderBy(desc(lookAheads.updatedAt)),

  /** One row for a detail or edit screen; re-runs only when that row changes. */
  byIdQuery: (db: Db, id: string) =>
    db.select().from(lookAheads).where(eq(lookAheads.id, id)).limit(1),

  async createLocal(db: Db, projectId: string, input: CreateLookAheadInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction((tx) => {
      tx.insert(lookAheads).values({
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
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "look-aheads",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
    return id;
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(lookAheads).set({ isPendingSync: false }).where(eq(lookAheads.id, id));
  },

  /** Removes the row locally and queues the push in one transaction. */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction((tx) => {
      tx.delete(lookAheads).where(eq(lookAheads.id, id)).run();
      enqueueDelete(tx, "look-aheads", id, projectId, randomUUID());
    });
  },

  /** Applies an edit locally and queues the push in one transaction. */
  async updateLocal(db: Db, projectId: string, id: string, patch: LookAheadPatch): Promise<void> {
    await db.transaction((tx) => {
      tx
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
        .where(eq(lookAheads.id, id)).run();

      enqueueUpdate(tx, "look-aheads", id, projectId, randomUUID());
      if (patch.activityIds !== undefined && (!id.startsWith("local_") || isRecordSending(tx, "look-aheads", id))) {
        reviveOrQueue(tx, { resource: "look-aheads", entityId: id, projectId, operation: "set-activities", newId: randomUUID() });
      }
    });
  },

  async reconcileCreate(db: Db, projectId: string, localId: string, server: LookAhead) {
    await db.transaction((tx) => {
      const [local] = tx.select().from(lookAheads).where(eq(lookAheads.id, localId)).limit(1).all();
      const hasEdits = remapQueuedRecord(tx, "look-aheads", localId, server.id);
      if (!local) return;
      tx.delete(lookAheads).where(eq(lookAheads.id, localId)).run();
      const values = {
        projectId,
        name: server.name,
        description: server.description,
        status: server.status,
        startDate: server.startDate,
        endDate: server.endDate,
        totalWorkers: server.totalWorkers,
        activityIds: serverActivityIds(server),
        buildingId: server.buildingId ?? local.buildingId,
        ...(hasEdits ? local : {}),
        id: server.id,
        isPendingSync: hasEdits,
        updatedAt: Date.now(),
      };
      // A concurrent pull may already have received the server-assigned ID.
      // Preserve any later local edit on that row while reconciling the draft.
      tx.insert(lookAheads).values(values).onConflictDoUpdate({
        target: lookAheads.id,
        set: values,
        where: eq(lookAheads.isPendingSync, false),
      }).run();
    });
  },

  async upsertFromServer(db: Db, projectId: string, rows: readonly LookAhead[]) {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction((tx) => {
      for (const row of rows) {
        tx
          .insert(lookAheads)
          .values({
            id: row.id,
            buildingId: row.buildingId ?? null,
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
              buildingId: row.buildingId ?? null,
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
          }).run();
      }
    });
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(lookAheads).where(eq(lookAheads.id, id)).limit(1);
    return row;
  },
};
