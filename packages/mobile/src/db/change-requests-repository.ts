import { randomUUID } from "expo-crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  changeCurrency,
  changeStatus,
  type ChangeRequest,
  type UpsertChangeRequestInput,
} from "@/api/change-requests";
import { CHANGE_REQUEST_COMMENTS_RESOURCE } from "./change-request-comments-repository";
import type { Db } from "./client";
import { enqueueDelete, enqueueUpdate } from "./enqueue-update";
import { changeRequestComments, changeRequests, outbox, type ChangeRequestRow } from "./schema";

export function toChangeRequest(row: ChangeRequestRow): ChangeRequest & { isPendingSync: boolean } {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    reason: row.reason,
    status: changeStatus(row.status),
    costImpact: row.costImpact,
    timeImpactDays: row.timeImpactDays,
    currency: changeCurrency(row.currency),
    isPendingSync: row.isPendingSync,
  };
}

export const changeRequestsRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(changeRequests)
      .where(eq(changeRequests.projectId, projectId))
      .orderBy(desc(changeRequests.updatedAt)),

  /** One row for a detail or edit screen; re-runs only when that row changes. */
  byIdQuery: (db: Db, id: string) =>
    db.select().from(changeRequests).where(eq(changeRequests.id, id)).limit(1),

  async createLocal(db: Db, projectId: string, input: UpsertChangeRequestInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(changeRequests).values({
        id,
        projectId,
        title: input.title,
        description: input.description ?? null,
        descriptionHtml: input.descriptionHtml ?? null,
        reason: input.reason ?? null,
        status: input.status ?? "Draft",
        costImpact: input.costImpact ?? 0,
        timeImpactDays: input.timeImpactDays ?? 0,
        currency: input.currency ?? "NGN",
        isPendingSync: true,
        updatedAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: "change-requests",
        entityId: id,
        projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  async markSynced(db: Db, id: string): Promise<void> {
    await db.update(changeRequests).set({ isPendingSync: false }).where(eq(changeRequests.id, id));
  },

  /**
   * Removes the row locally and queues the push in one transaction.
   *
   * Its local comments go with it: the server cascades, and a queued comment
   * left behind would push against an id that no longer exists.
   */
  async deleteLocal(db: Db, projectId: string, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const orphaned = await tx
        .select({ id: changeRequestComments.id })
        .from(changeRequestComments)
        .where(eq(changeRequestComments.changeRequestId, id));
      if (orphaned.length > 0) {
        const ids = orphaned.map((row) => row.id);
        await tx
          .delete(outbox)
          .where(and(eq(outbox.resource, CHANGE_REQUEST_COMMENTS_RESOURCE), inArray(outbox.entityId, ids)));
        await tx.delete(changeRequestComments).where(inArray(changeRequestComments.id, ids));
      }
      await tx.delete(changeRequests).where(eq(changeRequests.id, id));
      await enqueueDelete(tx as never, "change-requests", id, projectId, randomUUID());
    });
  },

  /** Applies an edit locally and queues the push in one transaction. */
  async updateLocal(
    db: Db,
    projectId: string,
    id: string,
    patch: Partial<UpsertChangeRequestInput>,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(changeRequests)
        .set({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.descriptionHtml !== undefined ? { descriptionHtml: patch.descriptionHtml } : {}),
          ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.costImpact !== undefined ? { costImpact: patch.costImpact } : {}),
          ...(patch.timeImpactDays !== undefined ? { timeImpactDays: patch.timeImpactDays } : {}),
          ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
          isPendingSync: true,
          updatedAt: Date.now(),
        })
        .where(eq(changeRequests.id, id));

      await enqueueUpdate(tx as never, "change-requests", id, projectId, randomUUID());
    });
  },

  async reconcileCreate(db: Db, projectId: string, localId: string, server: ChangeRequest) {
    await db.transaction(async (tx) => {
      await tx.delete(changeRequests).where(eq(changeRequests.id, localId));
      await tx.insert(changeRequests).values({
        id: server.id,
        projectId,
        title: server.title,
        description: server.description,
        descriptionHtml: server.descriptionHtml,
        reason: server.reason,
        status: server.status,
        costImpact: server.costImpact,
        timeImpactDays: server.timeImpactDays,
        currency: server.currency,
        isPendingSync: false,
        updatedAt: Date.now(),
      });
      // Comments written offline point at the local id. Moved here, in the
      // same transaction, so the outbox can push them now the request exists.
      await tx
        .update(changeRequestComments)
        .set({ changeRequestId: server.id })
        .where(eq(changeRequestComments.changeRequestId, localId));
    });
  },

  /** Server rows never overwrite one still waiting to be pushed. */
  async upsertFromServer(db: Db, projectId: string, rows: readonly ChangeRequest[]) {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(changeRequests)
          .values({
            id: row.id,
            projectId,
            title: row.title,
            description: row.description,
            descriptionHtml: row.descriptionHtml,
            reason: row.reason,
            status: row.status,
            costImpact: row.costImpact,
            timeImpactDays: row.timeImpactDays,
            currency: row.currency,
            isPendingSync: false,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: changeRequests.id,
            set: {
              title: row.title,
              description: row.description,
              descriptionHtml: row.descriptionHtml,
              reason: row.reason,
              status: row.status,
              costImpact: row.costImpact,
              timeImpactDays: row.timeImpactDays,
              currency: row.currency,
              updatedAt: now,
            },
            where: eq(changeRequests.isPendingSync, false),
          });
      }
    });
  },

  findById: async (db: Db, id: string) => {
    const [row] = await db.select().from(changeRequests).where(eq(changeRequests.id, id)).limit(1);
    return row;
  },
};
