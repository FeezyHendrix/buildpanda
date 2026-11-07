import { eq, getTableColumns, sql } from "drizzle-orm";
import type { Db } from "./client";
import { outbox, rfis, changeRequests, documents, materialOrders, materialApprovals, lookAheads } from "./schema";

export function outboxContextQuery(db: Db) {
  return db.select({
    ...getTableColumns(outbox),
    title: sql<string>`coalesce(${rfis.subject}, ${changeRequests.title}, ${documents.fileName}, ${materialOrders.title}, ${materialApprovals.title}, ${lookAheads.name}, ${outbox.entityId})`,
  }).from(outbox)
    .leftJoin(rfis, eq(outbox.entityId, rfis.id))
    .leftJoin(changeRequests, eq(outbox.entityId, changeRequests.id))
    .leftJoin(documents, eq(outbox.entityId, documents.id))
    .leftJoin(materialOrders, eq(outbox.entityId, materialOrders.id))
    .leftJoin(materialApprovals, eq(outbox.entityId, materialApprovals.id))
    .leftJoin(lookAheads, eq(outbox.entityId, lookAheads.id));
}

const DETAIL_ROUTES: Record<string, string> = {
  rfis: "rfis", "change-requests": "change-requests", documents: "documents",
  "material-orders": "materials", "material-approvals": "material-approvals", "look-aheads": "look-aheads",
};

export function outboxRecordPath(resource: string, entityId: string): string | null {
  const section = DETAIL_ROUTES[resource];
  return section ? `/tools/${section}/${encodeURIComponent(entityId)}` : null;
}
