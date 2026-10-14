import { materialsLedgerApi } from "@/api/materials-ledger";
import type { Db } from "./client";
import { materialLogRepository } from "./material-log-repository";
import { done, skipped, type OutboxHandlerResult, dropItem, finishItem } from "./outbox-handler";
import { type OutboxRow } from "./schema";

/** A logged delivery or usage. The ledger is append-only, so only creates queue. */
export async function pushMaterialLedgerOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "material-ledger") return skipped;

  const row = await materialLogRepository.findById(db, item.entityId);
  if (!row) return dropItem(db, item);

  const result = await materialsLedgerApi.logEntry(item.projectId, materialLogRepository.toLogInput(row));
  await materialLogRepository.reconcileCreate(db, item.projectId, row.id, result.entry);
  return finishItem(db, item);
}
