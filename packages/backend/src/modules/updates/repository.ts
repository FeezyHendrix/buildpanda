import type { Knex } from "knex";
import { ConflictError } from "../../lib/errors.ts";
import type {
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

export interface StatusTransition {
  updateId: string;
  status: UpdateStatus;
  actorId: string;
  actorName: string;
}

export function updatesRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<UpdateRow[]> {
      return db<UpdateRow>("project_updates")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
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
  };
}

export type UpdatesRepository = ReturnType<typeof updatesRepository>;
