import { eq } from "drizzle-orm";
import { rfisApi, type RfiPriority } from "@/api/rfis";
import type { Db } from "./client";
import { done, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, rfiComments, rfis, type OutboxRow } from "./schema";
import { rfiCommentsRepository } from "./rfi-comments-repository";
import { rfisRepository } from "./rfis-repository";

function rfiPriority(value: string): RfiPriority {
  if (value === "Low" || value === "Normal" || value === "High") return value;
  return "Normal";
}

export async function pushRfiOutboxItem(
  db: Db,
  item: OutboxRow,
): Promise<OutboxHandlerResult> {
  if (item.resource === "rfi-comments") return pushRfiComment(db, item);
  return pushRfi(db, item);
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

  const server = await rfisApi.addComment(item.projectId, comment.rfiId, comment.body, comment.contentHtml);
  await rfiCommentsRepository.reconcileCreate(db, comment.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}

async function pushRfi(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  const [row] = await db.select().from(rfis).where(eq(rfis.id, item.entityId)).limit(1);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  if (item.operation === "create") {
    const server = await rfisApi.create(item.projectId, {
      subject: row.subject,
      question: row.question,
      questionHtml: row.questionHtml,
      priority: rfiPriority(row.priority),
      dueDate: row.dueDate,
      costImpact: row.costImpact,
      scheduleImpact: row.scheduleImpact,
    });
    await rfisRepository.reconcileCreate(db, item.projectId, row.id, server);
  } else {
    await rfisApi.update(item.projectId, row.id, {
      subject: row.subject,
      question: row.question,
      questionHtml: row.questionHtml,
      priority: rfiPriority(row.priority),
    });
    await db
      .update(rfis)
      .set({ isPendingSync: false, serverLastSyncedAt: Date.now() })
      .where(eq(rfis.id, row.id));
  }

  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
