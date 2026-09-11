import { randomUUID } from "expo-crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Rfi, RfiStatusTransition, UpsertRfiInput } from "@/api/rfis";
import type { Db } from "./client";
import { enqueueUpdate, reviveOrQueue } from "./enqueue-update";
import { outbox, rfiComments, rfis, type RfiRow } from "./schema";

// Hermes has no global crypto.randomUUID; expo-crypto is the RN-safe source.
function localId(): string {
  return `local_${randomUUID()}`;
}

/**
 * An RFI as the device holds it. The local table does not cache who posted
 * the official response or when; the detail screen attributes it from the
 * official comment in the thread instead.
 */
export type LocalRfi = Omit<Rfi, "officialRespondedByName" | "officialRespondedAt"> & {
  isPendingSync: boolean;
};

export function toRfi(row: RfiRow): LocalRfi {
  return {
    id: row.id,
    number: row.number,
    subject: row.subject,
    question: row.question,
    questionHtml: row.questionHtml,
    status: row.status as Rfi["status"],
    priority: row.priority as Rfi["priority"],
    ballInCourtId: row.ballInCourtId,
    ballInCourtName: row.ballInCourtName,
    dueDate: row.dueDate,
    officialResponse: row.officialResponse,
    costImpact: row.costImpact,
    scheduleImpact: row.scheduleImpact,
    isPendingSync: row.isPendingSync,
  };
}

/** The server-owned columns a pull or a reconcile writes, in one place. */
function serverColumns(row: Rfi) {
  return {
    number: row.number,
    subject: row.subject,
    question: row.question,
    questionHtml: row.questionHtml ?? null,
    status: row.status,
    priority: row.priority,
    ballInCourtId: row.ballInCourtId ?? null,
    ballInCourtName: row.ballInCourtName,
    dueDate: row.dueDate,
    officialResponse: row.officialResponse,
    costImpact: row.costImpact,
    scheduleImpact: row.scheduleImpact,
  };
}

export const rfisRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(rfis)
      .where(and(eq(rfis.projectId, projectId), isNull(rfis.deletedAt)))
      .orderBy(desc(rfis.updatedAt)),

  /** One RFI for a detail or edit screen; a soft-deleted one reads as absent. */
  byIdQuery: (db: Db, id: string) =>
    db
      .select()
      .from(rfis)
      .where(and(eq(rfis.id, id), isNull(rfis.deletedAt)))
      .limit(1),

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
        questionHtml: input.questionHtml ?? null,
        priority: input.priority ?? "Normal",
        status: "Draft",
        ballInCourtId: input.ballInCourtId ?? null,
        ballInCourtName: input.ballInCourtName ?? null,
        dueDate: input.dueDate ?? null,
        documentId: input.documentId ?? null,
        documentVersionId: input.documentVersionId ?? null,
        sourceMarkupId: input.sourceMarkupId ?? null,
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
          ...(patch.questionHtml !== undefined ? { questionHtml: patch.questionHtml } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.ballInCourtId !== undefined ? { ballInCourtId: patch.ballInCourtId } : {}),
          ...(patch.ballInCourtName !== undefined ? { ballInCourtName: patch.ballInCourtName } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(patch.costImpact !== undefined ? { costImpact: patch.costImpact } : {}),
          ...(patch.scheduleImpact !== undefined ? { scheduleImpact: patch.scheduleImpact } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(rfis.id, id));

      await enqueueUpdate(tx as never, "rfis", id, projectId, randomUUID());
    });
  },

  /**
   * Closes, voids or reopens an RFI locally and queues the transition.
   *
   * A transition is its own outbox operation because the update endpoint
   * cannot change status. An RFI whose create is still queued has no server
   * id to transition, and the create endpoint always lands it as Draft, so
   * the crew member is told to wait rather than having a silent no-op queued.
   */
  async transitionLocal(
    db: Db,
    projectId: string,
    id: string,
    status: RfiStatusTransition,
  ): Promise<void> {
    if (id.startsWith("local_")) {
      throw new Error("This RFI has not reached the server yet. Try again once it has synced.");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(rfis)
        .set({ status, isPendingSync: true, updatedAt: Date.now() })
        .where(eq(rfis.id, id));
      await reviveOrQueue(tx as never, {
        resource: "rfis",
        entityId: id,
        projectId,
        operation: "transition",
        newId: randomUUID(),
      });
    });
  },

  async reconcileCreate(
    db: Db,
    projectId: string,
    localRowId: string,
    server: Rfi,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [local] = await tx
        .select({
          documentId: rfis.documentId,
          documentVersionId: rfis.documentVersionId,
          sourceMarkupId: rfis.sourceMarkupId,
        })
        .from(rfis)
        .where(eq(rfis.id, localRowId))
        .limit(1);
      await tx.delete(rfis).where(eq(rfis.id, localRowId));
      await tx.insert(rfis).values({
        id: server.id,
        projectId,
        ...serverColumns(server),
        // The list DTO does not echo the source sheet back; keep what was sent.
        documentId: local?.documentId ?? null,
        documentVersionId: local?.documentVersionId ?? null,
        sourceMarkupId: local?.sourceMarkupId ?? null,
        isPendingSync: false,
        serverLastSyncedAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Responses written offline point at the local id. Moved here, in the
      // same transaction, so the outbox can push them now the RFI exists.
      await tx.update(rfiComments).set({ rfiId: server.id }).where(eq(rfiComments.rfiId, localRowId));
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
            ...serverColumns(row),
            isPendingSync: false,
            serverLastSyncedAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: rfis.id,
            set: { ...serverColumns(row), serverLastSyncedAt: now, updatedAt: now },
            where: eq(rfis.isPendingSync, false),
          });
      }
    });
  },
};
