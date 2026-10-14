import { and, eq, inArray, or, sql } from "drizzle-orm";
import { allOf, DENY, type AccessRequirement, type FeatureAccess } from "@/lib/access-requirement";
import { approvalTierStatus } from "@/lib/api-access";
import { features } from "@/lib/feature-access";
import { AccessDeniedError, canAccess, projectAccess, requireAccess } from "@/lib/project-access-store";
import type { Db } from "./client";
import { getDbOwner } from "./ownership";
import { OUTBOX_TABLES } from "./outbox-tables";
import { outbox, rfis, rfiComments, type OutboxRow } from "./schema";
import { rfiReadWhere, rfiCommentReadWhere, requireRfiRead } from "./rfi-access";

const queueFeatures: Readonly<Record<string, FeatureAccess>> = {
  rfis: features.rfis, "rfi-comments": features.rfis,
  "change-requests": features.changeRequests, "change-request-comments": features.changeRequests,
  documents: features.documents, "drawing-markups": features.documents, "drawing-markup-comments": features.documents,
  "daily-logs": features.dailyLog, "daily-log-entries": features.dailyLog, "daily-log-activities": features.dailyLog,
  "material-orders": features.materialOrders, "material-ledger": features.materialLog,
  "material-approvals": features.materialApprovals, "material-approval-comments": features.materialApprovals,
  "look-aheads": features.schedule, tasks: features.tasks, expenses: features.expenses, updates: features.updates,
};

/** Resolve queue operations; grants themselves live only in the feature catalog. */
export function outboxRequirement(item: Pick<OutboxRow, "resource" | "operation">, row: Record<string, unknown> = {}): AccessRequirement {
  const feature = queueFeatures[item.resource];
  if (!feature) return DENY;
  let operation = ({ create: "create", update: "edit", delete: "remove", upsert: "create", transition: "transition", "set-activities": "edit" } as Record<string, string>)[item.operation];
  if (item.resource.endsWith("-comments")) operation = "comment";
  if (item.resource.startsWith("drawing-markup")) operation = "markup";
  if (item.resource === "rfi-comments" && row.official) operation = "officialResponse";
  if (item.resource === "material-ledger" && row.entry_type === "USED") operation = "usage";
  if (item.resource === "tasks" && item.operation === "update") operation = "move";
  if (item.resource === "material-orders") {
    if (item.operation === "delivery") operation = "receive";
    if (item.operation === "set-status") operation = approvalTierStatus(row.status) ? "approve" : "edit";
  }
  if (item.resource === "material-approvals" && item.operation === "decision") operation = row.status === "Pending" ? "reopen" : "decide";
  const policy = feature.actions[operation ?? ""] ?? DENY;
  return item.resource === "daily-log-activities" && row.delay_reason_code ? allOf(policy, features.schedule.actions.edit) : policy;
}

export function outboxReadWhere(db: Db) {
  const { scope } = projectAccess.getState();
  if (!scope || getDbOwner(db) !== scope.userId) return sql`0 = 1`;
  const resources = Object.entries(queueFeatures).filter(([, feature]) => canAccess(scope.projectId, feature.read)).map(([name]) => name);
  const visibleRfis = db.select({ id: rfis.id }).from(rfis).where(rfiReadWhere(db));
  const visibleComments = db.select({ id: rfiComments.id }).from(rfiComments).where(rfiCommentReadWhere(db));
  return resources.length ? and(eq(outbox.projectId, scope.projectId), inArray(outbox.resource, resources),
    or(sql`${outbox.resource} NOT IN ('rfis', 'rfi-comments')`,
      and(eq(outbox.resource, "rfis"), inArray(outbox.entityId, visibleRfis)),
      and(eq(outbox.resource, "rfi-comments"), inArray(outbox.entityId, visibleComments))))! : sql`0 = 1`;
}

export function requireOutboxAccess(db: Db, item: OutboxRow, write = true) {
  const ticket = requireAccess(item.projectId, queueFeatures[item.resource]?.read ?? DENY);
  if (getDbOwner(db) !== ticket.scope?.userId) throw new AccessDeniedError();
  const table = OUTBOX_TABLES[item.resource];
  const row = table ? db.get<Record<string, unknown>>(sql`SELECT * FROM ${table} WHERE id = ${item.entityId}`) : undefined;
  if (row && row.project_id !== item.projectId) throw new AccessDeniedError("This queued record belongs to a different project.");
  if (row && item.resource === "rfis") requireRfiRead(db, item.projectId, item.entityId);
  if (row && item.resource === "rfi-comments") {
    requireRfiRead(db, item.projectId, String(row.rfi_id));
    if (row.is_proposed_response && !ticket.snapshot.capabilities.canViewInternalRfis) throw new AccessDeniedError();
  }
  if (!write) return ticket;
  if (item.resource === "tasks" && item.operation !== "create" && !ticket.snapshot.capabilities.canSeeFullTaskBoard && !row?.assigned_to_me) throw new AccessDeniedError();
  requireAccess(item.projectId, outboxRequirement(item, row));
  if (item.resource === "material-approvals" && item.operation === "decision" && row?.status !== "Pending" &&
    row?.requested_reviewer_id && row.requested_reviewer_id !== ticket.scope?.userId) throw new AccessDeniedError("Only the requested reviewer can decide this request.");
  return ticket;
}
