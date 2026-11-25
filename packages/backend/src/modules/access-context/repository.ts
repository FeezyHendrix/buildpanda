import type { Knex } from "knex";
import { runQueries } from "../../lib/run-queries.ts";
import { BUILTIN_ROLES } from "../../lib/permissions.ts";
import type { AccessContextRows } from "../../plugins/access-cache.ts";

export function accessContextRepository(db: Knex) {
  const repository = {
    async loadMany(userIds: string[]): Promise<Map<string, AccessContextRows>> {
      const ids = [...new Set(userIds)];
      if (!ids.length) return new Map();
      const [members, participants] = await runQueries(db, [
        () => db("member").whereIn("userId", ids).select<(AccessContextRows["memberRows"][number] & { userId: string })[]>("userId", "organizationId", "role"),
        () => db("project_participants").whereIn("user_id", ids).where({ status: "active" }).select<(AccessContextRows["participantRows"][number] & { user_id: string })[]>("user_id", "project_id", "role", "permissions", "grants"),
      ]);
      const orgIds = [...new Set(members.filter((row) => !BUILTIN_ROLES.has(row.role)).map((row) => row.organizationId))];
      const roles = orgIds.length ? await db("organizationRole").whereIn("organizationId", orgIds).select<AccessContextRows["customRoleRows"]>("organizationId", "role", "permission") : [];
      return new Map(ids.map((userId) => {
        const memberRows = members.filter((row) => row.userId === userId).map(({ organizationId, role }) => ({ organizationId, role }));
        const organizations = new Set(memberRows.filter((row) => !BUILTIN_ROLES.has(row.role)).map((row) => row.organizationId));
        return [userId, { memberRows, customRoleRows: roles.filter((row) => organizations.has(row.organizationId)),
          participantRows: participants.filter((row) => row.user_id === userId).map(({ project_id, role, permissions, grants }) => ({ project_id, role, permissions, grants })) }];
      }));
    },
  };
  return { ...repository, async load(userId: string): Promise<AccessContextRows> {
    return (await repository.loadMany([userId])).get(userId)!;
  } };
}
