import { randomUUID } from "expo-crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Rfi, UpsertRfiInput } from "@/api/rfis";
import type { Db } from "./client";
import { enqueueUpdate } from "./enqueue-update";
import { outbox, rfis, type RfiRow } from "./schema";

// Hermes has no global crypto.randomUUID; expo-crypto is the RN-safe source.
function localId(): string {
  return `local_${randomUUID()}`;
}

export function toRfi(row: RfiRow): Rfi & { isPendingSync: boolean } {
  return {
    id: row.id,
    number: row.number,
    subject: row.subject,
    question: row.question,
    status: row.status as Rfi["status"],
    priority: row.priority as Rfi["priority"],
    ballInCourtName: row.ballInCourtName,
    dueDate: row.dueDate,
    officialResponse: row.officialResponse,
    costImpact: row.costImpact,
    scheduleImpact: row.scheduleImpact,
    isPendingSync: row.isPendingSync,
  };
}

export const rfisRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(rfis)
      .where(and(eq(rfis.projectId, projectId), isNull(rfis.deletedAt)))
      .orderBy(desc(rfis.updatedAt)),

  /**
   * Writes the RFI locally and queues the push in one transaction, so the row
   * and its outbox entry can never disagree if the app is killed mid-write.
   */
  async createLocal(db: Db, projectId: string, input: UpsertRfiInput): Promise<string> {
    const id = localId();
    const now = Date.now();

    await db.transaction(async (tx) => {
      await tx.insert(rfis).values({
        id,
        projectId,
        subject: input.subject,
        question: input.question,
        priority: input.priority ?? "Normal",
        status: "Draft",
        dueDate: input.dueDate ?? null,
        costImpact: input.costImpact ?? false,
        scheduleImpact: input.scheduleImpact ?? false,
        isPendingSync: true,
        serverLastSyncedAt: null,
        updatedAt: now,
      });

      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "rfis",
        entityId: id,
        projectId,
        operation: "create",
        baseUpdatedAt: null,
        nextAttemptAt: 0,
      });
    });

    return id;
  },

  /** Replaces the local placeholder with the row the server assigned. */
  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(rfis).set({ isPendingSync: false }).where(eq(rfis.id, id));
  },

  /** Applies an edit locally and queues the push in one transaction. */
  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<UpsertRfiInput>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(rfis)
        .set({
          ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
          ...(patch.question !== undefined ? { question: patch.question } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.costImpact !== undefined ? { costImpact: patch.costImpact } : {}),
          ...(patch.scheduleImpact !== undefined ? { scheduleImpact: patch.scheduleImpact } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(rfis.id, id));

      await enqueueUpdate(tx as never, "rfis", id, projectId);
    });
  },

  async reconcileCreate(
    db: Db,
    projectId: string,
    localRowId: string,
    server: Rfi,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(rfis).where(eq(rfis.id, localRowId));
      await tx.insert(rfis).values({
        id: server.id,
        projectId,
        number: server.number,
        subject: server.subject,
        question: server.question,
        status: server.status,
        priority: server.priority,
        ballInCourtName: server.ballInCourtName,
        dueDate: server.dueDate,
        officialResponse: server.officialResponse,
        costImpact: server.costImpact,
        scheduleImpact: server.scheduleImpact,
        isPendingSync: false,
        serverLastSyncedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  },

  /** Server rows never overwrite a row the crew member has edited locally. */
  async upsertFromServer(db: Db, projectId: string, rows: readonly Rfi[]): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(rfis)
          .values({
            id: row.id,
            projectId,
            number: row.number,
            subject: row.subject,
            question: row.question,
            status: row.status,
            priority: row.priority,
            ballInCourtName: row.ballInCourtName,
            dueDate: row.dueDate,
            officialResponse: row.officialResponse,
            costImpact: row.costImpact,
            scheduleImpact: row.scheduleImpact,
            isPendingSync: false,
            serverLastSyncedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: rfis.id,
            set: {
              number: row.number,
              subject: row.subject,
              question: row.question,
              status: row.status,
              priority: row.priority,
              ballInCourtName: row.ballInCourtName,
              dueDate: row.dueDate,
              officialResponse: row.officialResponse,
              costImpact: row.costImpact,
              scheduleImpact: row.scheduleImpact,
              serverLastSyncedAt: now,
              updatedAt: now,
            },
            where: eq(rfis.isPendingSync, false),
          });
      }
    });
  },
};
