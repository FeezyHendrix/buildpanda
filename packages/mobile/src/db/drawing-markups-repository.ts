import { randomUUID } from "expo-crypto";
import { and, eq } from "drizzle-orm";
import type { DrawingMarkup, MarkupKind } from "@/api/drawing-markup";
import type { MarkupGeometry } from "@/components/plan-review/markup-types";
import type { Db } from "./client";
import { drawingMarkups, outbox, type DrawingMarkupRow } from "./schema";

// Markups drawn on site are written here first and pushed by the outbox, so a
// redline survives a basement with no signal. Geometry is stored as the JSON
// the canvas produced, because only the canvas and the server read it.

const RESOURCE = "drawing-markups";

export interface LocalMarkupInput {
  projectId: string;
  documentId: string;
  documentVersionId: string;
  pageNo: number;
  kind: string;
  geometry: MarkupGeometry;
  color?: string;
}

function parseGeometry(raw: string): MarkupGeometry | null {
  try {
    return JSON.parse(raw) as MarkupGeometry;
  } catch {
    return null;
  }
}

/**
 * A local row in the shape the screen already renders. A markup that has not
 * reached the server yet has no author, no revision label and no comments;
 * those arrive with the server's copy when the push lands.
 */
export function toMarkup(row: DrawingMarkupRow): (DrawingMarkup & { isPendingSync: boolean }) | null {
  const geometry = parseGeometry(row.geometry);
  if (!geometry) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    documentId: row.documentId,
    documentVersionId: row.documentVersionId,
    revisionLabel: null,
    isCurrentRevision: true,
    pageNo: row.pageNo,
    kind: row.kind as MarkupKind,
    geometry,
    color: row.color,
    authorId: null,
    authorName: null,
    resolvedAt: row.resolvedAt,
    createdAt: new Date(row.updatedAt).toISOString(),
    comments: [],
    linkedRfiId: null,
    linkedApprovalId: null,
    isPendingSync: row.isPendingSync,
  };
}

export const drawingMarkupsRepository = {
  /** Every markup on one page of one sheet revision. */
  pageQuery: (db: Db, documentVersionId: string, pageNo: number) =>
    db
      .select()
      .from(drawingMarkups)
      .where(and(eq(drawingMarkups.documentVersionId, documentVersionId), eq(drawingMarkups.pageNo, pageNo))),

  findById: (db: Db, id: string) =>
    db
      .select()
      .from(drawingMarkups)
      .where(eq(drawingMarkups.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null),

  /** Writes the markup and queues its push in one transaction. */
  async createLocal(db: Db, input: LocalMarkupInput): Promise<string> {
    const id = `local_${randomUUID()}`;
    await db.transaction(async (tx) => {
      await tx.insert(drawingMarkups).values({
        id,
        projectId: input.projectId,
        documentId: input.documentId,
        documentVersionId: input.documentVersionId,
        pageNo: input.pageNo,
        kind: input.kind,
        geometry: JSON.stringify(input.geometry),
        color: input.color ?? "#004DE7",
        isPendingSync: true,
        updatedAt: Date.now(),
      });
      await tx.insert(outbox).values({
        id: randomUUID(),
        resource: RESOURCE,
        entityId: id,
        projectId: input.projectId,
        operation: "create",
        nextAttemptAt: 0,
      });
    });
    return id;
  },

  /** Replaces the local id with the server's once the push lands. */
  async reconcileCreate(db: Db, localId: string, serverId: string): Promise<void> {
    await db
      .update(drawingMarkups)
      .set({ id: serverId, isPendingSync: false, updatedAt: Date.now() })
      .where(eq(drawingMarkups.id, localId));
  },

  /** Server rows replace what is held for a page, except anything still queued. */
  async replacePage(db: Db, documentVersionId: string, pageNo: number, rows: (LocalMarkupInput & { id: string })[]): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(drawingMarkups)
        .where(and(eq(drawingMarkups.documentVersionId, documentVersionId), eq(drawingMarkups.pageNo, pageNo)));
      const pending = new Set(existing.filter((r) => r.isPendingSync).map((r) => r.id));
      for (const row of existing) {
        if (!pending.has(row.id)) await tx.delete(drawingMarkups).where(eq(drawingMarkups.id, row.id));
      }
      for (const row of rows) {
        if (pending.has(row.id)) continue;
        await tx.insert(drawingMarkups).values({
          id: row.id,
          projectId: row.projectId,
          documentId: row.documentId,
          documentVersionId: row.documentVersionId,
          pageNo: row.pageNo,
          kind: row.kind,
          geometry: JSON.stringify(row.geometry),
          color: row.color ?? "#004DE7",
          isPendingSync: false,
          updatedAt: Date.now(),
        });
      }
    });
  },

  async removeLocal(db: Db, id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(drawingMarkups).where(eq(drawingMarkups.id, id));
      await tx.delete(outbox).where(and(eq(outbox.resource, RESOURCE), eq(outbox.entityId, id)));
    });
  },
};
