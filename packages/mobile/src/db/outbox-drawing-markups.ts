import { eq } from "drizzle-orm";
import { drawingMarkupApi } from "@/api/drawing-markup";
import type { MarkupGeometry } from "@/components/plan-review/markup-types";
import type { Db } from "./client";
import { drawingMarkupsRepository } from "./drawing-markups-repository";
import { done, skipped, type OutboxHandlerResult } from "./outbox-handler";
import { outbox, type OutboxRow } from "./schema";

export async function pushDrawingMarkupOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "drawing-markups") return skipped;

  if (item.operation === "delete") {
    await drawingMarkupApi.remove(item.projectId, item.entityId);
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(true);
  }

  const row = await drawingMarkupsRepository.findById(db, item.entityId);
  if (!row) {
    await db.delete(outbox).where(eq(outbox.id, item.id));
    return done(false);
  }

  const server = await drawingMarkupApi.create(item.projectId, {
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    pageNo: row.pageNo,
    kind: row.kind as never,
    geometry: JSON.parse(row.geometry) as MarkupGeometry,
    color: row.color,
  });
  await drawingMarkupsRepository.reconcileCreate(db, row.id, server.id);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  return done(true);
}
