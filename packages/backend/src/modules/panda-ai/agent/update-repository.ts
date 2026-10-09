import type { Knex } from "knex";
import type { PublishedProjectUpdate } from "./update-types.ts";

export function updateAgentRepository(db: Knex) {
  return {
    publishedUpdates(projectId: string, stageId?: string): Promise<PublishedProjectUpdate[]> {
      return db("project_updates as u")
        .leftJoin("activities as activity", function () {
          this.on("activity.id", "u.activity_id").andOn("activity.project_id", "u.project_id");
        })
        .where("u.project_id", projectId).where("u.is_draft", false)
        .modify((query) => {
          if (stageId) query.whereRaw("coalesce(u.stage_id, activity.phase_id) = ?", [stageId]);
        })
        .orderBy("u.created_at", "desc").limit(100)
        .select("u.id", "u.title", "u.description", "u.category", "u.status",
          "u.author_name as author", "u.created_at as createdAt", "u.activity_id as activityId",
          db.raw('coalesce(u.stage_id, activity.phase_id) as "stageId"'));
    },
  };
}
