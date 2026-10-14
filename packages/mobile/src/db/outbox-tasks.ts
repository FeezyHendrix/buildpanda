import { tasksApi } from "@/api/tasks";
import { readCachedUser } from "@/lib/session-cache";
import type { Db } from "./client";
import { done, skipped, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { type OutboxRow } from "./schema";
import { settleOutboxItem } from "./sync-write-state";
import { tasksRepository } from "./tasks-repository";

/** A task added on site, or moved to another column (its status). */
export async function pushTaskOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "tasks") return skipped;

  const row = await tasksRepository.findById(db, item.entityId);
  if (!row) return dropItem(db, item);

  if (item.operation === "update") {
    await tasksApi.move(item.projectId, row.id, row.columnId, row.position);
    settleOutboxItem(db, item);
    return done(true);
  }

  const server = await tasksApi.create(item.projectId, tasksRepository.toCreateInput(row));
  await tasksRepository.reconcileCreate(db, row, server, readCachedUser()?.id ?? null);
  return finishItem(db, item);
}
