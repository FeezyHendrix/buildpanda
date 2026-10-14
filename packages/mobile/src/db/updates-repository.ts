import { repositoryAccess } from "./permissions";
import { features } from "@/lib/feature-access";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { ProjectUpdate, UpdateCategory } from "@/api/updates";
import { discardStagedMedia, stageMedia } from "@/lib/stage-media";
import type { Db } from "./client";
import { reviveOrQueue } from "./enqueue-update";
import {
  projectUpdateMedia,
  projectUpdates,
  type ProjectUpdateMediaRow,
  type ProjectUpdateRow,
} from "./schema";

const access = repositoryAccess(features.updates);

export const UPDATES_RESOURCE = "updates";

// Expo SQLite transactions are synchronous; helpers must finish before commit.
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function localId(): string {
  return `local_${randomUUID()}`;
}

export interface LocalUpdateMedia {
  id: string;
  type: "photo" | "video";
  /**
   * The server url once the bytes are up, and until then the durable local
   * copy — so a thumbnail renders in a basement, before any upload.
   */
  url: string;
}

/**
 * An update as the device holds it. The local table does not cache the author's
 * id: nothing on the device reads it, and the create endpoint attributes the
 * post from the session rather than the body.
 */
export type LocalProjectUpdate = Omit<ProjectUpdate, "author"> & {
  author: { name: string; role: string };
  isPendingSync: boolean;
};

export interface LocalUpdateMediaInput {
  /** Where the picker left the file; copied somewhere durable before the write. */
  uri: string;
  fileName: string;
  mimeType: string | null;
  type: "photo" | "video";
}

export interface LocalUpdateInput {
  category: UpdateCategory;
  title: string;
  description: string;
  descriptionHtml?: string | null;
  stageId?: string | null;
  authorName?: string | null;
  media: readonly LocalUpdateMediaInput[];
}

function toUpdateMedia(row: ProjectUpdateMediaRow): LocalUpdateMedia {
  return {
    id: row.id,
    type: row.type === "video" ? "video" : "photo",
    url: row.url ?? row.stagedUri ?? "",
  };
}

export function toProjectUpdate(
  row: ProjectUpdateRow,
  media: readonly ProjectUpdateMediaRow[] = [],
): LocalProjectUpdate {
  return {
    id: row.id,
    stageId: row.stageId,
    activityId: row.activityId,
    category: row.category as UpdateCategory,
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml,
    author: { name: row.authorName ?? "", role: row.authorRole ?? "" },
    media: media.map(toUpdateMedia),
    status: row.status ?? "Open",
    // Field Tools never caches a draft: the pull filters them out before this
    // table is written, so a cached row is always a posted update.
    isDraft: false,
    generatedKind: null,
    createdAt: row.createdAt,
    isPendingSync: row.isPendingSync,
  };
}

/** The column values one server DTO maps to, shared by insert and conflict update. */
function fromServer(projectId: string, row: ProjectUpdate, now: number) {
  return {
    projectId,
    stageId: row.stageId ?? null,
    activityId: row.activityId ?? null,
    category: row.category,
    title: row.title,
    description: row.description,
    descriptionHtml: row.descriptionHtml ?? null,
    authorName: row.author?.name ?? null,
    authorRole: row.author?.role ?? null,
    status: row.status ?? null,
    createdAt: row.createdAt,
    isPendingSync: false,
    updatedAt: now,
  };
}

/** The server DTO carries no file name, so the uploaded one is read back off its url. */
function fileNameFromUrl(url: string): string {
  const segment = url.split("?")[0].split("/").filter(Boolean).at(-1);
  return segment && segment !== "view" ? segment : "attachment";
}

function replaceServerMedia(tx: Tx, update: ProjectUpdate): void {
  tx.delete(projectUpdateMedia).where(eq(projectUpdateMedia.updateId, update.id)).run();
  update.media.forEach((item, position) => {
    tx.insert(projectUpdateMedia).values({
      id: item.id,
      updateId: update.id,
      type: item.type,
      stagedUri: null,
      url: item.url,
      fileName: fileNameFromUrl(item.url),
      mimeType: null,
      position,
    }).run();
  });
}

const mediaColumns = {
  id: projectUpdateMedia.id,
  updateId: projectUpdateMedia.updateId,
  type: projectUpdateMedia.type,
  stagedUri: projectUpdateMedia.stagedUri,
  url: projectUpdateMedia.url,
  fileName: projectUpdateMedia.fileName,
  mimeType: projectUpdateMedia.mimeType,
  position: projectUpdateMedia.position,
};

export const updatesRepository = {
  listQuery: (db: Db, projectId: string) =>
    db
      .select()
      .from(projectUpdates)
      .where(access.where(db, projectUpdates.projectId, eq(projectUpdates.projectId, projectId)))
      .orderBy(desc(projectUpdates.createdAt)),

  /** Every attachment on the project, so the feed can count and preview them. */
  mediaQuery: (db: Db, projectId: string) =>
    db
      .select(mediaColumns)
      .from(projectUpdateMedia)
      .innerJoin(projectUpdates, eq(projectUpdateMedia.updateId, projectUpdates.id))
      .where(access.where(db, projectUpdates.projectId, eq(projectUpdates.projectId, projectId)))
      .orderBy(asc(projectUpdateMedia.position)),

  async findById(db: Db, id: string): Promise<ProjectUpdateRow | undefined> {
    const [row] = await db.select().from(projectUpdates).where(access.where(db, projectUpdates.projectId, eq(projectUpdates.id, id))).limit(1);
    return row;
  },

  async mediaFor(db: Db, updateId: string): Promise<ProjectUpdateMediaRow[]> {
    return db
      .select(mediaColumns)
      .from(projectUpdateMedia)
      .innerJoin(projectUpdates, eq(projectUpdateMedia.updateId, projectUpdates.id))
      .where(access.where(db, projectUpdates.projectId, eq(projectUpdateMedia.updateId, updateId)))
      .orderBy(asc(projectUpdateMedia.position));
  },

  /**
   * Records where one file landed on the server. Written per file, so a push
   * that dies halfway through ten photos retries from the one it died on
   * rather than re-sending the bytes it already got up.
   */
  async setMediaUrl(db: Db, mediaId: string, url: string): Promise<void> {
    await db.update(projectUpdateMedia).set({ url }).where(and(eq(projectUpdateMedia.id, mediaId),
      inArray(projectUpdateMedia.updateId, db.select({ id: projectUpdates.id }).from(projectUpdates)
        .where(access.where(db, projectUpdates.projectId)))));
  },

  /**
   * Server rows refresh the cache. A queued update has a `local_` id the
   * server never hands out, so it is never touched here; and any row still
   * flagged pending is skipped outright, because it carries work the server
   * has not seen yet.
   */
  async upsertFromServer(
    db: Db,
    projectId: string,
    rows: readonly ProjectUpdate[],
  ): Promise<void> {
    access.require(db, projectId);
    if (rows.length === 0) return;
    const now = Date.now();
    await access.transaction(db, projectId, "read", (tx) => {
      const cached = new Map(
        tx.select().from(projectUpdates)
          .where(access.where(db, projectUpdates.projectId, inArray(projectUpdates.id, rows.map((row) => row.id))))
          .all().map((row) => [row.id, row]),
      );
      for (const row of rows) {
        const existing = cached.get(row.id);
        if (existing?.isPendingSync) continue;
        const values = fromServer(projectId, row, now);
        tx
          .insert(projectUpdates)
          .values({ id: row.id, ...values })
          .onConflictDoUpdate({ target: projectUpdates.id, set: values }).run();
        replaceServerMedia(tx, row);
      }
    });
  },

  /**
   * Writes the update and its attachments locally and queues the push, in one
   * transaction, so the row and its outbox entry can never disagree if the app
   * is killed mid-write.
   *
   * Every file is copied somewhere durable first: an update written in a
   * basement can wait hours for signal, and the picker's cache copy does not
   * survive that. Each copy is named after its own media row, so ten photos on
   * one update cannot overwrite each other.
   */
  async createLocal(db: Db, projectId: string, input: LocalUpdateInput): Promise<string> {
    access.require(db, projectId, "create");
    const id = localId();
    const staged: {
      id: string;
      type: "photo" | "video";
      fileName: string;
      mimeType: string | null;
      stagedUri: string;
      position: number;
    }[] = [];

    try {
      input.media.forEach((item, position) => {
        const mediaId = localId();
        staged.push({
          id: mediaId,
          type: item.type,
          fileName: item.fileName,
          mimeType: item.mimeType,
          stagedUri: stageMedia(item.uri, mediaId, item.fileName),
          position,
        });
      });

      await access.transaction(db, projectId, "create", (tx) => {
        tx.insert(projectUpdates).values({
          id,
          projectId,
          stageId: input.stageId ?? null,
          activityId: null,
          category: input.category,
          title: input.title,
          description: input.description,
          descriptionHtml: input.descriptionHtml ?? null,
          authorName: input.authorName ?? null,
          authorRole: null,
          // The server stamps "Open" on every new update; mirroring it keeps a
          // queued row reading the same as the one that comes back.
          status: "Open",
          createdAt: new Date().toISOString(),
          isPendingSync: true,
          updatedAt: Date.now(),
        }).run();

        for (const item of staged) {
          tx.insert(projectUpdateMedia).values({
            id: item.id,
            updateId: id,
            type: item.type,
            stagedUri: item.stagedUri,
            url: null,
            fileName: item.fileName,
            mimeType: item.mimeType,
            position: item.position,
          }).run();
        }

        reviveOrQueue(tx, {
          resource: UPDATES_RESOURCE,
          entityId: id,
          projectId,
          operation: "create",
          newId: randomUUID(),
        });
      });
    } catch (err) {
      for (const item of staged) discardStagedMedia(item.stagedUri);
      throw err;
    }

    return id;
  },

  /**
   * The push landed: the local row gives way to the server's copy. Delete and
   * insert rather than an id update, because a pull may already have fetched
   * the new update under its server id. The staged bytes go once the server
   * holds them.
   */
  async reconcileCreate(
    db: Db,
    projectId: string,
    localRowId: string,
    server: ProjectUpdate,
  ): Promise<void> {
    access.require(db, projectId);
    const staged = await this.mediaFor(db, localRowId);
    const values = fromServer(projectId, server, Date.now());
    await access.transaction(db, projectId, "read", (tx) => {
      tx.delete(projectUpdateMedia).where(eq(projectUpdateMedia.updateId, localRowId)).run();
      tx.delete(projectUpdates).where(access.where(db, projectUpdates.projectId, eq(projectUpdates.id, localRowId))).run();
      tx
        .insert(projectUpdates)
        .values({ id: server.id, ...values })
        .onConflictDoUpdate({ target: projectUpdates.id, set: values }).run();
      replaceServerMedia(tx, server);
    });
    for (const row of staged) discardStagedMedia(row.stagedUri);
  },
};
