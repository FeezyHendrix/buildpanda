import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import type { LogMaterialEntryInput, MaterialLedgerEntry, MaterialStockLevel } from "@/api/materials-ledger";
import type { Db } from "./client";
import { materialLedgerEntries, materialOrders, materialStock, outbox } from "./schema";

const access = repositoryAccess(features.materialLog);

export interface MaterialLogEntryInput {
  entryType: "IN" | "USED";
  materialName: string;
  unit: string;
  quantity: number;
  stageId: string | null;
  notesHtml: string | null;
  loggedByName: string;
  /** The order this receipt is for, picked on site. */
  materialOrderId?: string | null;
  materialOrderTitle?: string | null;
}

function serverValues(projectId: string, row: MaterialLedgerEntry) {
  return {
    projectId,
    entryType: row.entryType,
    status: row.status,
    materialName: row.materialName,
    unit: row.unit,
    quantity: Number(row.quantity),
    stageId: row.stageId,
    stageName: row.stageName,
    approvalStatus: row.approvalStatus,
    occurredAt: row.occurredAt,
    negativeStock: row.negativeStock,
    loggedByName: row.loggedByName,
    notesHtml: row.notesHtml,
    materialOrderId: row.materialOrderId ?? null,
    materialOrderTitle: row.materialOrderTitle ?? null,
  };
}

export const materialLogRepository = {
  entriesQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(materialLedgerEntries)
      .where(access.where(db, materialLedgerEntries.projectId, eq(materialLedgerEntries.projectId, projectId)))
      .orderBy(desc(materialLedgerEntries.occurredAt)),

  stockQuery: (db: Db, projectId: string) =>
    db.select().from(materialStock).where(access.where(db, materialStock.projectId, eq(materialStock.projectId, projectId))).orderBy(asc(materialStock.materialName)),

  /**
   * The movement and its push in one transaction. The local id doubles as the
   * idempotency key, so a push retried after a dropped response is a replay,
   * not a second delivery.
   */
  async createLocal(db: Db, projectId: string, input: MaterialLogEntryInput): Promise<string> {
    access.require(db, projectId, input.entryType === "USED" ? "usage" : "create");
    if (input.materialOrderId) access.record(db, materialOrders, input.materialOrderId, projectId);
    const id = `local_${randomUUID()}`;
    await access.transaction(db, projectId, input.entryType === "USED" ? "usage" : "create", (tx) => {
      tx.insert(materialLedgerEntries).values({
        id,
        projectId,
        entryType: input.entryType,
        materialName: input.materialName,
        unit: input.unit,
        quantity: input.quantity,
        stageId: input.stageId,
        occurredAt: new Date().toISOString(),
        loggedByName: input.loggedByName,
        notesHtml: input.notesHtml,
        materialOrderId: input.entryType === "IN" ? input.materialOrderId ?? null : null,
        materialOrderTitle: input.entryType === "IN" ? input.materialOrderTitle ?? null : null,
        // Explicit, not the column default, which still reads "Pending": the
        // server no longer gates a log on approval, so a crew member must not
        // watch their own entry sit "Awaiting approval" until it syncs.
        approvalStatus: "Approved",
        isPendingSync: true,
        updatedAt: Date.now(),
      }).run();
      tx.insert(outbox).values({
        id: randomUUID(),
        resource: "material-ledger",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      }).run();
    });
    return id;
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(materialLedgerEntries).where(access.where(db, materialLedgerEntries.projectId, eq(materialLedgerEntries.id, id))).limit(1);
    return row;
  },

  toLogInput: (row: typeof materialLedgerEntries.$inferSelect): LogMaterialEntryInput => ({
    entryType: row.entryType === "USED" ? "USED" : "IN",
    materialName: row.materialName,
    unit: row.unit,
    quantity: row.quantity,
    stageId: row.stageId,
    occurredAt: row.occurredAt,
    notesHtml: row.notesHtml,
    materialOrderId: row.materialOrderId,
    idempotencyKey: row.id,
  }),

  async reconcileCreate(db: Db, projectId: string, localId: string, server: MaterialLedgerEntry) {
    await access.transaction(db, projectId, "read", (tx) => {
      tx.delete(materialLedgerEntries).where(access.where(db, materialLedgerEntries.projectId, eq(materialLedgerEntries.id, localId))).run();
      const values = { ...serverValues(projectId, server), isPendingSync: false, updatedAt: Date.now() };
      tx.insert(materialLedgerEntries).values({ id: server.id, ...values })
        .onConflictDoUpdate({ target: materialLedgerEntries.id, set: values }).run();
    });
  },

  /**
   * The ledger is append-only on the server, so a pull upserts what it was
   * sent and drops synced rows it no longer lists (older than the page). A
   * movement still waiting to send is never touched.
   */
  async replaceEntries(db: Db, projectId: string, rows: readonly MaterialLedgerEntry[]) {
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      const ids = rows.map((row) => row.id);
      tx.delete(materialLedgerEntries).where(access.where(db, materialLedgerEntries.projectId, and(
        eq(materialLedgerEntries.projectId, projectId),
        eq(materialLedgerEntries.isPendingSync, false),
        ...(ids.length ? [notInArray(materialLedgerEntries.id, ids)] : []),
      ))).run();
      for (const row of rows) {
        const values = { ...serverValues(projectId, row), updatedAt: now };
        tx.insert(materialLedgerEntries).values({ id: row.id, ...values, isPendingSync: false })
          .onConflictDoUpdate({ target: materialLedgerEntries.id, set: values, where: eq(materialLedgerEntries.isPendingSync, false) })
          .run();
      }
    });
  },

  async replaceStock(db: Db, projectId: string, rows: readonly MaterialStockLevel[]) {
    await access.transaction(db, projectId, "read", (tx) => {
      tx.delete(materialStock).where(access.where(db, materialStock.projectId, eq(materialStock.projectId, projectId))).run();
      for (const row of rows) {
        tx.insert(materialStock).values({
          id: `${projectId}:${row.materialId}:${row.locationKey}`,
          projectId,
          materialName: row.materialName,
          unit: row.unit,
          locationKey: row.locationKey,
          onHandQty: Number(row.onHandQty),
          lowStock: row.lowStock,
        }).run();
      }
    });
  },
};
