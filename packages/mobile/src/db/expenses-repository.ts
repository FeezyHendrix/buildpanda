import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { randomUUID } from "expo-crypto";
import { and, desc, eq, notInArray } from "drizzle-orm";
import type { Expense } from "@/api/expenses";
import { stageMedia } from "@/lib/stage-media";
import type { Db } from "./client";
import { expenses, outbox, type ExpenseRow } from "./schema";
import { expenseReadWhere } from "./record-visibility";

const access = repositoryAccess(features.expenses);

export interface LocalExpenseInput {
  title: string;
  category: string;
  categoryLabel: string;
  amount: number;
  transactedAt: string;
  vendor: string | null;
  description: string | null;
  stageId: string | null;
  credit: boolean;
  receipt: { uri: string; fileName: string; mimeType: string } | null;
  createdByName: string;
}

function serverValues(projectId: string, row: Expense) {
  return {
    projectId,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryLabel: row.categoryLabel,
    amount: Number(row.amount),
    transactedAt: row.transactedAt,
    vendor: row.vendor,
    stageId: row.stageId,
    stageName: row.stageName,
    credit: row.credit,
    receiptFileId: row.receiptFileId,
    createdById: row.createdById ?? null,
    createdByName: row.createdByName,
  };
}

export const expensesRepository = {
  listQuery: (db: Db, projectId: string) =>
    db.select().from(expenses).where(access.where(db, expenses.projectId, expenseReadWhere(), eq(expenses.projectId, projectId))).orderBy(desc(expenses.transactedAt), desc(expenses.updatedAt)),

  findById: async (db: Db, id: string): Promise<ExpenseRow | undefined> => {
    const [row] = await db.select().from(expenses).where(access.where(db, expenses.projectId, expenseReadWhere(), eq(expenses.id, id))).limit(1);
    return row;
  },

  /** The expense and its push in one transaction; the receipt is copied somewhere durable first. */
  async createLocal(db: Db, projectId: string, input: LocalExpenseInput): Promise<string> {
    const ticket = access.require(db, projectId, "create");
    const id = `local_${randomUUID()}`;
    const stagedUri = input.receipt ? stageMedia(input.receipt.uri, id, input.receipt.fileName) : null;
    await access.transaction(db, projectId, "create", (tx) => {
      tx.insert(expenses).values({
        id,
        projectId,
        title: input.title,
        description: input.description,
        category: input.category,
        categoryLabel: input.categoryLabel,
        amount: input.amount,
        transactedAt: input.transactedAt,
        vendor: input.vendor,
        stageId: input.stageId,
        credit: input.credit,
        receiptStagedUri: stagedUri,
        receiptMimeType: input.receipt?.mimeType ?? null,
        createdById: ticket.scope!.userId,
        createdByName: input.createdByName,
        isPendingSync: true,
        updatedAt: Date.now(),
      }).run();
      tx.insert(outbox).values({ id: randomUUID(), resource: "expenses", entityId: id, projectId, operation: "create", nextAttemptAt: 0 }).run();
    });
    return id;
  },

  /** Kept on the row so a retry after a failed create does not upload the receipt twice. */
  async setReceiptFileId(db: Db, id: string, fileId: string) {
    await db.update(expenses).set({ receiptFileId: fileId }).where(access.where(db, expenses.projectId, expenseReadWhere(), eq(expenses.id, id)));
  },

  async reconcileCreate(db: Db, projectId: string, localId: string, server: Expense) {
    await access.transaction(db, projectId, "read", (tx) => {
      tx.delete(expenses).where(access.where(db, expenses.projectId, expenseReadWhere(), eq(expenses.id, localId))).run();
      const values = { ...serverValues(projectId, server), receiptStagedUri: null, isPendingSync: false, updatedAt: Date.now() };
      tx.insert(expenses).values({ id: server.id, ...values }).onConflictDoUpdate({ target: expenses.id, set: values }).run();
    });
  },

  async replaceFromServer(db: Db, projectId: string, rows: readonly Expense[]) {
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      const ids = rows.map((row) => row.id);
      tx.delete(expenses).where(access.where(db, expenses.projectId, and(
        eq(expenses.projectId, projectId),
        eq(expenses.isPendingSync, false),
        ...(ids.length ? [notInArray(expenses.id, ids)] : []),
      ))).run();
      for (const row of rows) {
        const values = { ...serverValues(projectId, row), updatedAt: now };
        tx.insert(expenses).values({ id: row.id, ...values, isPendingSync: false })
          .onConflictDoUpdate({ target: expenses.id, set: values, where: eq(expenses.isPendingSync, false) }).run();
      }
    });
  },
};
