import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { ProjectDocument } from "@/api/documents";
import type { Db } from "./client";
import { documentCategories, documents, type DocumentCategoryRow, type DocumentRow } from "./schema";

/** Matches the web: two groups, no media tab. */
export type DocumentGroup = "plan" | "document";

export const DOCUMENT_GROUP = {
  PLAN: "plan",
  DOCUMENT: "document",
} as const satisfies Record<string, DocumentGroup>;

export function groupOf(row: { group: string }): DocumentGroup {
  return row.group === DOCUMENT_GROUP.PLAN ? DOCUMENT_GROUP.PLAN : DOCUMENT_GROUP.DOCUMENT;
}

export function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    fileName: row.fileName,
    size: row.size,
    category: row.category,
    group: groupOf(row),
    status: row.status,
    versionNo: row.versionNo,
    currentVersionId: row.currentVersionId,
    localUri: row.localUri,
    isAvailableOffline: Boolean(row.localUri),
  };
}

export function toCategory(row: DocumentCategoryRow) {
  return {
    id: row.id,
    name: row.name,
    fileCount: row.fileCount,
    totalSize: row.totalSize,
    tone: row.tone,
    group: row.group === DOCUMENT_GROUP.PLAN ? DOCUMENT_GROUP.PLAN : DOCUMENT_GROUP.DOCUMENT,
  };
}

export const documentsRepository = {
  recentQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(documents)
      .where(and(eq(documents.projectId, projectId), gt(documents.lastAccessedAt ?? 0, 0)))
      .orderBy(desc(documents.lastAccessedAt))
      .limit(5),

  async trackAccess(db: Db, documentId: string): Promise<void> {
    await db
      .update(documents)
      .set({ lastAccessedAt: Date.now() })
      .where(eq(documents.id, documentId));
  },

  categoriesQuery: (db: Db, projectId: string) =>
    db.select().from(documentCategories).where(eq(documentCategories.projectId, projectId)),

  async upsertCategories(
    db: Db,
    projectId: string,
    rows: readonly {
      id: string;
      name: string;
      fileCount: number;
      totalSize: string;
      tone: string;
      group: string;
    }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(documentCategories)
          .values({
            id: row.id,
            projectId,
            name: row.name,
            fileCount: row.fileCount,
            totalSize: row.totalSize,
            tone: row.tone,
            group: row.group,
          })
          .onConflictDoUpdate({
            target: documentCategories.id,
            set: {
              name: row.name,
              fileCount: row.fileCount,
              totalSize: row.totalSize,
              tone: row.tone,
              group: row.group,
            },
          });
      }
    });
  },

  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(asc(documents.fileName)),

  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly ProjectDocument[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(documents)
          .values({
            id: row.id,
            projectId,
            fileName: row.fileName,
            size: row.size ?? "",
            category: row.category ?? null,
            group: (row as { group?: string }).group ?? "document",
            status: (row as { status?: string }).status ?? null,
            versionNo: (row as { versionNo?: number }).versionNo ?? 1,
            currentVersionId: (row as { currentVersionId?: string | null }).currentVersionId ?? null,
            uploadedAt: (row as { uploadedAt?: string }).uploadedAt ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: documents.id,
            set: {
              fileName: row.fileName,
              size: row.size ?? "",
              category: row.category ?? null,
              group: (row as { group?: string }).group ?? "document",
              versionNo: (row as { versionNo?: number }).versionNo ?? 1,
              currentVersionId:
                (row as { currentVersionId?: string | null }).currentVersionId ?? null,
              updatedAt: now,
              // localUri is deliberately not touched — a downloaded blob stays
              // valid across metadata refreshes.
            },
          });
      }
    });
  },

  async setLocalUri(db: Db, documentId: string, uri: string | null): Promise<void> {
    await db.update(documents).set({ localUri: uri }).where(eq(documents.id, documentId));
  },

  async findById(db: Db, documentId: string): Promise<DocumentRow | undefined> {
    const [row] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    return row;
  },
};
