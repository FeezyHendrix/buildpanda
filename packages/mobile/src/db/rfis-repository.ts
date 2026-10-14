import { rfiReadWhere, requireRfiRead } from "./rfi-access";
import { projectAccess } from "@/lib/project-access-store";
import { requireDrawingReference } from "./record-permissions";
import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { remapQueuedRecord } from "./sync-write-state";
import { randomUUID } from "expo-crypto";
import { desc, eq, isNull } from "drizzle-orm";
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
const access = repositoryAccess(features.rfis);

export type LocalRfi = Omit<Rfi, "officialRespondedByName" | "officialRespondedAt"> & {
  isPendingSync: boolean;
};

export function toRfi(row: RfiRow): LocalRfi {
  return {
    id: row.id,
    number: row.number,
    changeRequestId: row.changeRequestId ?? null,
    subject: row.subject,
    question: row.question,
    questionHtml: row.questionHtml,
    status: row.status as Rfi["status"],
    visibility: row.visibility as Rfi["visibility"],
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
    changeRequestId: row.changeRequestId ?? null,
    subject: row.subject,
    question: row.question,
    questionHtml: row.questionHtml ?? null,
    status: row.status,
    visibility: row.visibility ?? "internal",
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
      .where(rfiReadWhere(db, eq(rfis.projectId, projectId), isNull(rfis.deletedAt)))
      .orderBy(desc(rfis.updatedAt)),

  /** One RFI for a detail or edit screen; a soft-deleted one reads as absent. */
  byIdQuery: (db: Db, id: string) =>
    db
      .select()
      .from(rfis)
      .where(rfiReadWhere(db, eq(rfis.id, id), isNull(rfis.deletedAt)))
      .limit(1),

  /** The RFI raised from one plan pin, or nothing; derived locally so it reads offline. */
  bySourceMarkupQuery: (db: Db, markupId: string) =>
    db
      .select()
      .from(rfis)
      .where(rfiReadWhere(db, eq(rfis.sourceMarkupId, markupId), isNull(rfis.deletedAt)))
      .limit(1),

  /**
   * Writes the RFI locally and queues the push in one transaction, so the row
   * and its outbox entry can never disagree if the app is killed mid-write.
   */
  async createLocal(db: Db, projectId: string, input: UpsertRfiInput): Promise<string> {
    access.require(db, projectId, "create");
    requireDrawingReference(db, projectId, input);
    const id = localId();
    const now = Date.now();

    await access.transaction(db, projectId, "create", (tx) => {
      tx.insert(rfis).values({
        id,
        projectId,
        subject: input.subject,
        question: input.question,
        questionHtml: input.questionHtml ?? null,
        priority: input.priority ?? "Normal",
        status: input.ballInCourtId ? "Open" : "Draft",
        visibility: projectAccess.getState().snapshot?.capabilities.createsSharedRfis ? "shared" : "internal",
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
      }).run();

      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "rfis",
        entityId: id,
        projectId,
        operation: "create",
        baseUpdatedAt: null,
        nextAttemptAt: 0,
      }).run();
    });

    return id;
  },

  /** Replaces the local placeholder with the row the server assigned. */
  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(rfis).set({ isPendingSync: false }).where(access.where(db, rfis.projectId, eq(rfis.id, id)));
  },

  /** Applies an edit locally and queues the push in one transaction. */
  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<UpsertRfiInput>,
  ): Promise<void> {
    access.require(db, projectId, "edit");
    requireRfiRead(db, projectId, id);
    await access.transaction(db, projectId, "edit", (tx) => {
      tx
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
        .where(access.where(db, rfis.projectId, eq(rfis.id, id))).run();

      enqueueUpdate(tx, "rfis", id, projectId, randomUUID());
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
    access.require(db, projectId, "edit");
    requireRfiRead(db, projectId, id);
    if (id.startsWith("local_")) {
      throw new Error("This RFI has not reached the server yet. Try again once it has synced.");
    }
    await access.transaction(db, projectId, "edit", (tx) => {
      tx
        .update(rfis)
        .set({ status, isPendingSync: true, updatedAt: Date.now() })
        .where(access.where(db, rfis.projectId, eq(rfis.id, id))).run();
      reviveOrQueue(tx, {
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
    access.require(db, projectId);
    await access.transaction(db, projectId, "read", (tx) => {
      const [local] = tx
        .select()
        .from(rfis)
        .where(access.where(db, rfis.projectId, eq(rfis.id, localRowId)))
        .limit(1).all();
      const hasEdits = remapQueuedRecord(tx, "rfis", localRowId, server.id);
      if (!local) return;
      tx.delete(rfis).where(access.where(db, rfis.projectId, eq(rfis.id, localRowId))).run();
      const values = {
        projectId,
        ...serverColumns(server),
        // The list DTO does not echo the source sheet back; keep what was sent.
        documentId: local?.documentId ?? null,
        documentVersionId: local?.documentVersionId ?? null,
        sourceMarkupId: local?.sourceMarkupId ?? null,
        ...(hasEdits ? local : {}),
        id: server.id,
        number: server.number,
        isPendingSync: hasEdits,
        serverLastSyncedAt: Date.now(),
        updatedAt: Date.now(),
      };
      // A concurrent pull may already have received the server-assigned ID.
      // Preserve any later local edit on that row while reconciling the draft.
      tx.insert(rfis).values(values).onConflictDoUpdate({
        target: rfis.id,
        set: values,
        where: eq(rfis.isPendingSync, false),
      }).run();
      // Responses written offline point at the local id. Moved here, in the
      // same transaction, so the outbox can push them now the RFI exists.
      tx.update(rfiComments).set({ rfiId: server.id }).where(access.where(db, rfiComments.projectId, eq(rfiComments.rfiId, localRowId))).run();
    });
  },

  /** Server rows never overwrite a row the crew member has edited locally. */
  async upsertFromServer(db: Db, projectId: string, rows: readonly Rfi[]): Promise<void> {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      for (const row of rows) {
        tx
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
          }).run();
      }
    });
  },
};
