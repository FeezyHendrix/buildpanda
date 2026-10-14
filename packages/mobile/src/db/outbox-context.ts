import { outboxReadWhere } from "./outbox-access";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { Db } from "./client";
import { outbox, rfis, changeRequests, documents, materialOrders, materialApprovals, lookAheads, materialLedgerEntries, tasks, expenses } from "./schema";

export function outboxContextQuery(db: Db) {
  return db.select({
    ...getTableColumns(outbox),
    title: sql<string>`coalesce(${rfis.subject}, ${changeRequests.title}, ${documents.fileName}, ${materialOrders.title}, ${materialApprovals.title}, ${lookAheads.name}, ${materialLedgerEntries.materialName}, ${tasks.title}, ${expenses.title}, ${outbox.entityId})`,
  }).from(outbox)
    .leftJoin(rfis, and(eq(outbox.entityId, rfis.id), eq(outbox.projectId, rfis.projectId), eq(outbox.resource, "rfis")))
    .leftJoin(changeRequests, and(eq(outbox.entityId, changeRequests.id), eq(outbox.projectId, changeRequests.projectId), eq(outbox.resource, "change-requests")))
    .leftJoin(documents, and(eq(outbox.entityId, documents.id), eq(outbox.projectId, documents.projectId), eq(outbox.resource, "documents")))
    .leftJoin(materialOrders, and(eq(outbox.entityId, materialOrders.id), eq(outbox.projectId, materialOrders.projectId), eq(outbox.resource, "material-orders")))
    .leftJoin(materialApprovals, and(eq(outbox.entityId, materialApprovals.id), eq(outbox.projectId, materialApprovals.projectId), eq(outbox.resource, "material-approvals")))
    .leftJoin(lookAheads, and(eq(outbox.entityId, lookAheads.id), eq(outbox.projectId, lookAheads.projectId), eq(outbox.resource, "look-aheads")))
    .leftJoin(materialLedgerEntries, and(eq(outbox.entityId, materialLedgerEntries.id), eq(outbox.projectId, materialLedgerEntries.projectId), eq(outbox.resource, "material-ledger")))
    .leftJoin(tasks, and(eq(outbox.entityId, tasks.id), eq(outbox.projectId, tasks.projectId), eq(outbox.resource, "tasks")))
    .leftJoin(expenses, and(eq(outbox.entityId, expenses.id), eq(outbox.projectId, expenses.projectId), eq(outbox.resource, "expenses")))
    .where(outboxReadWhere(db));
}

const DETAIL_ROUTES: Record<string, string> = {
  rfis: "rfis", "change-requests": "change-requests", documents: "documents",
  "material-orders": "materials", "material-approvals": "material-approvals", "look-aheads": "look-aheads", tasks: "tasks",
};

export function outboxRecordPath(resource: string, entityId: string): string | null {
  const section = DETAIL_ROUTES[resource];
  return section ? `/tools/${section}/${encodeURIComponent(entityId)}` : null;
}
