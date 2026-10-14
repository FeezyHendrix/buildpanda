import { eq } from "drizzle-orm";
import { expensesApi, type Expense } from "@/api/expenses";
import { uploadProjectFile } from "@/api/files";
import { discardStagedMedia } from "@/lib/stage-media";
import type { Db } from "./client";
import { expensesRepository } from "./expenses-repository";
import { done, skipped, type OutboxHandlerResult, dropItem } from "./outbox-handler";
import { outbox, type ExpenseRow, type OutboxRow } from "./schema";

/**
 * The expenses API has no idempotency key. If an earlier attempt may have
 * landed (its response lost on a weak connection), look for it before posting
 * again rather than logging the same receipt twice.
 */
async function alreadyLogged(projectId: string, row: ExpenseRow): Promise<Expense | undefined> {
  const existing = await expensesApi.list(projectId);
  return existing.find((e) =>
    e.title === row.title &&
    Number(e.amount) === row.amount &&
    e.transactedAt.slice(0, 10) === row.transactedAt.slice(0, 10) &&
    e.category === row.category);
}

export async function pushExpenseOutboxItem(db: Db, item: OutboxRow): Promise<OutboxHandlerResult> {
  if (item.resource !== "expenses") return skipped;

  const row = await expensesRepository.findById(db, item.entityId);
  if (!row) return dropItem(db, item);

  const earlier = item.attempts > 0 || item.lastError ? await alreadyLogged(item.projectId, row) : undefined;
  let server = earlier;
  if (!server) {
    let receiptFileId = row.receiptFileId;
    if (!receiptFileId && row.receiptStagedUri) {
      const name = row.receiptStagedUri.split("/").pop() ?? "receipt.jpg";
      const uploaded = await uploadProjectFile(item.projectId, row.receiptStagedUri, name, row.receiptMimeType ?? "image/jpeg");
      receiptFileId = uploaded.id;
      await expensesRepository.setReceiptFileId(db, row.id, uploaded.id);
    }
    server = await expensesApi.create(item.projectId, {
      title: row.title,
      category: row.category,
      amount: row.amount,
      transactedAt: row.transactedAt,
      description: row.description,
      vendor: row.vendor,
      receiptFileId,
      stageId: row.stageId,
      credit: row.credit,
    });
  }

  await expensesRepository.reconcileCreate(db, item.projectId, row.id, server);
  await db.delete(outbox).where(eq(outbox.id, item.id));
  discardStagedMedia(row.receiptStagedUri);
  return done(true);
}
