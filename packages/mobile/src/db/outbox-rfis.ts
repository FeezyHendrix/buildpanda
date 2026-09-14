import { and, eq, ne } from "drizzle-orm";
import {
  RFI_STATUS_TRANSITIONS,
  rfisApi,
  type RfiComment,
  type RfiDetail,
  type RfiPriority,
  type RfiStatusTransition,
} from "@/api/rfis";
import type { Db } from "./client";
import { done, PermanentOutboxError, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, rfiComments, rfis, type OutboxRow, type RfiRow } from "./schema";
import { rfiCommentsRepository } from "./rfi-comments-repository";
import { rfisRepository } from "./rfis-repository";

function rfiPriority(value: string): RfiPriority {
  if (value === "Low" || value === "Normal" || value === "High") return value;
  return "Normal";
}

function isTransition(value: string): value is RfiStatusTransition {
  return (RFI_STATUS_TRANSITIONS as readonly string[]).includes(value);
}

export async function pushRfiOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource === "rfi-comments") return pushRfiComment(db, item);
  if (item.resource === "rfis") return pushRfi(db, item);
  return skipped;
}

/**
 * The server does not flag which comment is the official one, so the reply
 * just posted is found by content: the newest comment carrying the same body.
 */
function findPostedComment(detail: RfiDetail, body: string): RfiComment | null {
  const matches = (detail.comments ?? []).filter((c) => c.body === body);
  if (matches.length === 0) return null;
  return matches.reduce((newest, c) =>
    Date.parse(c.createdAt) > Date.parse(newest.createdAt) ? c : newest,
  );
}

async function pushRfiComment(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [comment] = await db
    .select()
    .from(rfiComments)
    .where(eq(rfiComments.id, item.entityId))
    .limit(1);
  if (!comment) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }
  if (comment.rfiId.startsWith("local_")) return done(false);

  if (comment.official) {
    const detail = await rfisApi.respond(item.projectId, comment.rfiId, {
      body: comment.body,
      contentHtml: comment.contentHtml,
      official: true,
    });
    const posted = findPostedComment(detail, comment.body);
    if (posted) {
      await rfiCommentsRepository.reconcileCreate(db, comment.id, posted, true);
    } else {
      // The server accepted it but its thread does not show it back; the
      // upsert below carries whatever the server holds, so drop the placeholder.
      await db.delete(rfiComments).where(eq(rfiComments.id, comment.id));
    }
    // The response changed the RFI itself (Answered, official text, ball in
    // court), so write the whole detail back rather than waiting for a pull.
    await rfisRepository.upsertFromServer(db, item.projectId, [detail]);
    await rfiCommentsRepository.upsertFromServer(db, item.projectId, detail.comments ?? []);
  } else {
    const server = await rfisApi.addComment(item.projectId, comment.rfiId, comment.body, comment.contentHtml);
    await rfiCommentsRepository.reconcileCreate(db, comment.id, server);
  }

  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

/**
 * True while another outbox row still targets this RFI. Clearing the pending
 * flag then would let a pull overwrite a status or edit that has not gone yet.
 */
async function otherWorkQueued(db: Db, item: OutboxRow): Promise<boolean> {
  const rows = await db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(eq(outbox.resource, "rfis"), eq(outbox.entityId, item.entityId), ne(outbox.id, item.id)),
    )
    .limit(1);
  return rows.length > 0;
}

async function settle(db: Db, item: OutboxRow, row: RfiRow): Promise<void> {
  if (!(await otherWorkQueued(db, item))) {
    await db
      .update(rfis)
      .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
      .where(eq(rfis.id, row.id));
  }
}

async function pushRfi(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [row] = await db.select().from(rfis).where(eq(rfis.id, item.entityId)).limit(1);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "create") {
    // Raised from a pin whose own create has not landed: the markup's push
    // re-points this row to the server id, so wait for it rather than sending
    // a reference the server cannot resolve.
    if (row.sourceMarkupId?.startsWith("local_")) return done(false);
    const server = await rfisApi.create(item.projectId, {
      subject: row.subject,
      question: row.question,
      questionHtml: row.questionHtml,
      priority: rfiPriority(row.priority),
      ballInCourtId: row.ballInCourtId,
      ballInCourtName: row.ballInCourtName,
      dueDate: row.dueDate,
      costImpact: row.costImpact,
      scheduleImpact: row.scheduleImpact,
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      sourceMarkupId: row.sourceMarkupId,
    });
    await rfisRepository.reconcileCreate(db, item.projectId, row.id, server);
  } else if (item.operation === "transition") {
    if (!isTransition(row.status)) {
      throw new PermanentOutboxError(
        `An RFI can only be closed, voided or reopened; "${row.status}" is not a transition.`,
      );
    }
    await rfisApi.transition(item.projectId, row.id, row.status);
    await settle(db, item, row);
  } else {
    // The update endpoint refuses the source-sheet fields, so they stay off.
    await rfisApi.update(item.projectId, row.id, {
      subject: row.subject,
      question: row.question,
      questionHtml: row.questionHtml,
      priority: rfiPriority(row.priority),
      ballInCourtId: row.ballInCourtId,
      ballInCourtName: row.ballInCourtName,
      dueDate: row.dueDate,
      costImpact: row.costImpact,
      scheduleImpact: row.scheduleImpact,
    });
    await settle(db, item, row);
  }

  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
