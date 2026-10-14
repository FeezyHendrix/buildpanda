import type { Knex } from "knex";
import { BUILTIN_ROLES } from "../../lib/permissions.ts";
import type { AccessContextRows } from "../../plugins/access-cache.ts";

export function accessContextRepository(db: Knex) {
  return {
    async load(userId: string): Promise<AccessContextRows> {
      const [memberRows, participantRows] = await Promise.all([
        db("member").where({ userId }).select<AccessContextRows["memberRows"]>("organizationId", "role"),
        db("project_participants").where({ user_id: userId, status: "active" }).select<AccessContextRows["participantRows"]>("project_id", "role", "permissions", "grants"),
      ]);
      const orgIds = memberRows.map((row) => row.organizationId);
      const customRoleRows = orgIds.length && memberRows.some((row) => !BUILTIN_ROLES.has(row.role))
        ? await db("organizationRole").whereIn("organizationId", orgIds).select<AccessContextRows["customRoleRows"]>("organizationId", "role", "permission") : [];
      return { memberRows, customRoleRows, participantRows };
    },
  };
}
