import { randomUUID } from "expo-crypto";
import { desc, eq } from "drizzle-orm";
import type { ChangeRequest, UpsertChangeRequestInput } from "@/api/change-requests";
import type { Db } from "./client";
import { changeRequests, outbox, type ChangeRequestRow } from "./schema";

export function toChangeRequest(row: ChangeRequestRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    status: row.status,
    costImpact: row.costImpact,
    timeImpactDays: row.timeImpactDays,
    currency: row.currency,
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
        costImpact: input.costImpact ?? 0,
        timeImpactDays: input.timeImpactDays ?? 0,
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
              status: row.status,
              costImpact: row.costImpact,
              timeImpactDays: row.timeImpactDays,
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
