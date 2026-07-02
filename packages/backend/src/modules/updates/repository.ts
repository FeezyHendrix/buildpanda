import type { Knex } from "knex";
import { ConflictError } from "../../lib/errors.ts";
import type { Tone } from "../projects/types.ts";
import type {
  CtaTone,
  UpdateCategory,
  UpdateCommentRow,
  UpdateMediaRow,
  UpdateRow,
  UpdateStatus,
} from "./types.ts";

export interface NewCommentRecord {
  id: string;
  update_id: string;
  author_id: string;
  author_name: string;
  body: string;
}

export interface NewUpdateRecord {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  author_initials_tone: Tone;
  activity_id?: string | null;
  category: UpdateCategory;
  title: string;
  description: string;
  description_html: string | null;
  cta_label: string;
  cta_tone: CtaTone;
  status: UpdateStatus;
  is_draft?: boolean;
  generated_kind?: string | null;
  created_at: Date;
}

export interface UpdateContentPatch {
  title?: string;
  description?: string;
  description_html?: string | null;
  category?: UpdateCategory;
  cta_label?: string;
  cta_tone?: CtaTone;
}

export interface StatusTransition {
  updateId: string;
  status: UpdateStatus;
  actorId: string;
  actorName: string;
}

export function updatesRepository(db: Knex) {
  return {
    listByProject(
      projectId: string,
      options: { includeDrafts?: boolean } = {},
    ): Promise<UpdateRow[]> {
      return db<UpdateRow>("project_updates")
        .where({ project_id: projectId })
        .modify((query) => {
          if (!options.includeDrafts) query.where({ is_draft: false });
        })
        .orderBy("created_at", "desc");
    },

    findDraftByKind(
      projectId: string,
      generatedKind: string,
      since: Date,
    ): Promise<UpdateRow | undefined> {
      return db<UpdateRow>("project_updates")
        .where({
          project_id: projectId,
          generated_kind: generatedKind,
          is_draft: true,
        })
        .where("created_at", ">=", since)
        .orderBy("created_at", "desc")
        .first();
    },

    async publishUpdate(updateId: string): Promise<UpdateRow> {
      const [row] = await db<UpdateRow>("project_updates")
        .where({ id: updateId })
        // Publishing resets created_at so the update surfaces to the
        // homeowner as of the moment it went live, not when it was drafted.
        .update({ is_draft: false, created_at: new Date() })
        .returning("*");
      if (!row) throw new ConflictError("Update not found");
      return row;
    },

    findById(updateId: string): Promise<UpdateRow | undefined> {
      return db<UpdateRow>("project_updates").where({ id: updateId }).first();
    },

    mediaForUpdates(updateIds: string[]): Promise<UpdateMediaRow[]> {
      if (updateIds.length === 0) return Promise.resolve([]);
      return db<UpdateMediaRow>("update_media")
        .whereIn("update_id", updateIds)
        .orderBy([
          { column: "update_id", order: "asc" },
          { column: "sort_order", order: "asc" },
        ]);
    },

    async transitionStatus(transition: StatusTransition): Promise<UpdateRow> {
      return db.transaction(async (trx) => {
        const current = await trx<UpdateRow>("project_updates")
          .where({ id: transition.updateId })
          .forUpdate()
          .first();
        if (!current) throw new ConflictError("Update not found");

        await trx("project_updates")
          .where({ id: transition.updateId })
          .update({
            status: transition.status,
            action_taken_at: new Date(),
            action_taken_by_id: transition.actorId,
            action_taken_by_name: transition.actorName,
          });

        const updated = await trx<UpdateRow>("project_updates")
          .where({ id: transition.updateId })
          .first();
        if (!updated) throw new ConflictError("Update disappeared");
        return updated;
      });
    },

    listComments(updateId: string): Promise<UpdateCommentRow[]> {
      return db<UpdateCommentRow>("update_comments")
        .where({ update_id: updateId })
        .orderBy("created_at", "asc");
    },

    async addComment(record: NewCommentRecord): Promise<UpdateCommentRow> {
      const [row] = await db<UpdateCommentRow>("update_comments").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert comment");
      return row;
    },

    async createUpdate(
      record: NewUpdateRecord,
      media: UpdateMediaRow[] = [],
    ): Promise<UpdateRow> {
      return db.transaction(async (trx) => {
        const [row] = await trx<UpdateRow>("project_updates")
          .insert(record)
          .returning("*");
        if (!row) throw new Error("Failed to insert update");
        if (media.length > 0) {
          await trx<UpdateMediaRow>("update_media").insert(media);
        }
        return row;
      });
    },

    async editUpdate(
      updateId: string,
      patch: UpdateContentPatch,
    ): Promise<UpdateRow> {
      const [row] = await db<UpdateRow>("project_updates")
        .where({ id: updateId })
        .update(patch)
        .returning("*");
      if (!row) throw new ConflictError("Update not found");
      return row;
    },

    async replaceMedia(
      updateId: string,
      media: UpdateMediaRow[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("update_media").where({ update_id: updateId }).del();
        if (media.length > 0) {
          await trx<UpdateMediaRow>("update_media").insert(media);
        }
      });
    },

    async deleteUpdate(updateId: string): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("update_comments").where({ update_id: updateId }).del();
        await trx("update_media").where({ update_id: updateId }).del();
        await trx("project_updates").where({ id: updateId }).del();
      });
    },
  };
}

export type UpdatesRepository = ReturnType<typeof updatesRepository>;
