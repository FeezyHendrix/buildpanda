import type { Knex } from "knex";
import { canProjectPermission } from "../../lib/authorization.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { projectsRepository } from "../projects/repository.ts";

/** A filename notification must not reveal a record the recipient cannot view. */
export function documentNotificationAccess(db: Knex) {
  return async (userIds: string[], projectId: string) => {
    const [project, loaded] = await Promise.all([projectsRepository(db).findById(projectId), accessContextRepository(db).loadMany(userIds)]);
    if (!project) return [];
    return userIds.filter((userId) => {
      const rows = loaded.get(userId);
      return rows && canProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        resolveAccessContext(userId, rows), "documents", "view",
      );
    });
  };
}
