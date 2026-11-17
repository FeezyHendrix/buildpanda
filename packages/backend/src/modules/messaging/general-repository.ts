import type { Knex } from "knex";
import type { ProjectRow } from "../projects/types.ts";

export function projectGeneralRepository(db: Knex) {
  return {
    lockProject: (projectId: string) => db<Pick<ProjectRow, "id" | "owner_id">>("projects").where({ id: projectId }).forUpdate().first("id", "owner_id"),
    memberIds: (projectId: string) => db("project_participants").where({ project_id: projectId, status: "active" }).whereNotNull("user_id").pluck<string[]>("user_id"),
  };
}
