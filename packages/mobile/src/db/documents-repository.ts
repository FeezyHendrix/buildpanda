import { and, asc, desc, eq, gt } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { DocumentGroup, ProjectDocument } from "@/api/documents";
import { discardStagedMedia, stageMedia } from "@/lib/stage-media";
import type { Db } from "./client";
import { documentCategories, documents, outbox, type DocumentCategoryRow, type DocumentRow } from "./schema";

export type { DocumentGroup };

// The backend's three groups. The Plans and Documents tabs mirror the web's
// two pages; media has its own library on the web and is kept out of both
// here rather than folded into Documents.
export const DOCUMENT_GROUP = {
  PLAN: "plan",
  DOCUMENT: "document",
  MEDIA: "media",
} as const satisfies Record<string, DocumentGroup>;

export const DOCUMENTS_RESOURCE = "documents";

/**
 * Same rule as the web's `filed`: plans are plans, media is media, and any
 * other group (a proposal snapshot, say) is filed with the documents.
 */
export function groupOf(row: { group: string }): DocumentGroup {
  if (row.group === DOCUMENT_GROUP.PLAN) return DOCUMENT_GROUP.PLAN;
  if (row.group === DOCUMENT_GROUP.MEDIA) return DOCUMENT_GROUP.MEDIA;
  return DOCUMENT_GROUP.DOCUMENT;
}

export function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    fileName: row.fileName,
    size: row.size,
    category: row.category,
    categoryId: row.categoryId,
    group: groupOf(row),
    status: row.status,
    versionNo: row.versionNo,
    currentVersionId: row.currentVersionId,
    mimeType: row.mimeType,
    localUri: row.localUri,
    stagedUri: row.stagedUri,
    isAvailableOffline: Boolean(row.localUri),
    isPendingSync: row.isPendingSync,
  };
}

export type LocalDocument = ReturnType<typeof toDocument>;

export function toCategory(row: DocumentCategoryRow) {
  return {
    id: row.id,
    name: row.name,
    fileCount: row.fileCount,
    totalSize: row.totalSize,
    tone: row.tone,
    group: groupOf(row),
  };
}

export interface LocalDocumentInput {
  /** Where the picker left the file; it is copied somewhere durable before this returns. */
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  categoryId: string;
  categoryName: string;
  group: DocumentGroup;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The column values one server DTO maps to, shared by insert and conflict update. */
function fromServer(projectId: string, row: ProjectDocument, now: number) {
  return {
    projectId,
    fileName: row.fileName,
    size: row.size ?? "",
    category: row.category ?? null,
    categoryId: row.categoryId ?? null,
    group: row.group ?? DOCUMENT_GROUP.DOCUMENT,
    status: row.status ?? null,
    versionNo: row.versionNo ?? 1,
    currentVersionId: row.currentVersionId ?? null,
    uploadedAt: row.uploadedAt ?? null,
    stagedUri: null,
    isPendingSync: false,
    updatedAt: now,
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

  /**
   * Server rows refresh the cache. A queued upload has a `local_` id the
   * server never hands out, so it is never touched here; `localUri` is left
   * alone because a downloaded blob stays valid across metadata refreshes.
   */
  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly ProjectDocument[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const now = Date.now();
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const values = fromServer(projectId, row, now);
        await tx
          .insert(documents)
          .values({ id: row.id, ...values })
          .onConflictDoUpdate({ target: documents.id, set: values });
      }
    });
  },

  /**
   * Files a picked document on the device and queues its upload, in one
   * transaction. The bytes are copied to the document directory first: a file
   * picked in a basement can wait hours for signal, and the picker's cache
   * copy does not survive that.
   */
  async createLocal(db: Db, projectId: string, input: LocalDocumentInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    const stagedUri = stageMedia(input.uri, id, input.fileName);
    try {
      await db.transaction(async (tx) => {
        await tx.insert(documents).values({
          id,
          projectId,
          fileName: input.fileName,
          size: formatSize(input.sizeBytes),
          category: input.categoryName,
          categoryId: input.categoryId,
          group: input.group,
          status: null,
          // no version exists until the server files it
          versionNo: 0,
          currentVersionId: null,
          uploadedAt: new Date().toISOString(),
          mimeType: input.mimeType,
          stagedUri,
          isPendingSync: true,
          updatedAt: Date.now(),
        });
        await tx.insert(outbox).values({
          id: randomUUID(),
          resource: DOCUMENTS_RESOURCE,
          entityId: id,
          projectId,
          operation: "create",
          nextAttemptAt: 0,
        });
      });
    } catch (err) {
      discardStagedMedia(stagedUri);
      throw err;
    }
    return id;
  },

  /**
   * The upload landed: the local row gives way to the server's copy. Delete
   * and insert rather than an id update, because a pull may already have
   * fetched the new document under its server id.
   */
  async reconcileCreate(
    db: Db,
    projectId: string,
    localId: string,
    server: ProjectDocument,
  ): Promise<void> {
    const local = await this.findById(db, localId);
    const values = fromServer(projectId, server, Date.now());
    await db.transaction(async (tx) => {
      await tx.delete(documents).where(eq(documents.id, localId));
      await tx
        .insert(documents)
        .values({ id: server.id, ...values, mimeType: local?.mimeType ?? null })
        .onConflictDoUpdate({ target: documents.id, set: values });
    });
    discardStagedMedia(local?.stagedUri ?? null);
  },

  async setLocalUri(db: Db, documentId: string, uri: string | null): Promise<void> {
    await db.update(documents).set({ localUri: uri }).where(eq(documents.id, documentId));
  },

  async findById(db: Db, documentId: string): Promise<DocumentRow | undefined> {
    const [row] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    return row;
  },
};
