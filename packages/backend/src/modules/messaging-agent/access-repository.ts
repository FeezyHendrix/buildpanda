import type { Knex } from "knex";
import type { EnrichedAccessContext } from "../../lib/authorization.ts";
import type { MessagingUserRow } from "./management-types.ts";
import type { ProjectRow } from "../projects/types.ts";

export function messagingAgentAccessRepository(db: Knex) {
  return {
    user: (id: string) => db<MessagingUserRow>("user").where({ id })
      .select("id", "name", "banned", "banExpires").first(),
    project: (id: string) => db<ProjectRow>("projects").where({ id }).first(),
    candidates: (context: EnrichedAccessContext) => db<ProjectRow>("projects").where((query) => {
      query.where("owner_id", context.userId);
      const organizations = [...context.orgRoles.keys()];
      const projects = [...(context.projectRoles?.keys() ?? [])];
      if (organizations.length) query.orWhereIn("organization_id", organizations);
      if (projects.length) query.orWhereIn("id", projects);
    }).orderBy("name"),
  };
}
