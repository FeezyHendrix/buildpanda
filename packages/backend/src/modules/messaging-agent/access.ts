import type { Knex } from "knex";
import { canProjectPermission, assertProjectPermission } from "../../lib/authorization.ts";
import { BadRequestError, FeatureDisabledError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors.ts";
import { statement } from "../../lib/permissions.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { featureFlagsRepository } from "../feature-flags/repository.ts";
import { featureFlagsService } from "../feature-flags/service.ts";
import { messagingAgentAccessRepository } from "./access-repository.ts";
import type { MessagingAccess, MessagingProjectOption } from "./management-types.ts";

export function messagingAgentAccess(db: Knex) {
  const repo = messagingAgentAccessRepository(db);
  const contextRepo = accessContextRepository(db);

  async function actor(userId: string) {
    const user = await repo.user(userId);
    if (!user || (user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now()))) {
      throw new UnauthorizedError("This account is unavailable. Sign in again to reconnect Messaging.");
    }
    return { user, context: resolveAccessContext(userId, await contextRepo.load(userId)) };
  }

  return {
    actor,
    async projects(userId: string): Promise<MessagingProjectOption[]> {
      const { context } = await actor(userId);
      const candidates = await repo.candidates(context);
      return candidates.filter((project) => {
        const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
        return canProjectPermission(scope, context, "project", "view") &&
          (canProjectPermission(scope, context, "dailyLog", "view") || canProjectPermission(scope, context, "dailyLog", "create"));
      }).map((project) => ({ id: project.id, name: project.name, organizationId: project.organization_id }));
    },
    async project(userId: string, projectId: string, action?: "view" | "create"): Promise<MessagingAccess> {
      const { user, context } = await actor(userId);
      const project = await repo.project(projectId);
      if (!project) throw new NotFoundError("Project");
      const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
      assertProjectPermission(scope, context, "project", "view");
      if (action) assertProjectPermission(scope, context, "dailyLog", action);
      else if (!canProjectPermission(scope, context, "dailyLog", "view") && !canProjectPermission(scope, context, "dailyLog", "create")) {
        throw new ForbiddenError("You cannot use daily logs on this project.");
      }
      if (!(await featureFlagsService(featureFlagsRepository(db)).isEnabled("quality.dailyLogs"))) {
        throw new FeatureDisabledError("quality.dailyLogs", "Daily logs");
      }
      const permissions = Object.fromEntries(Object.entries(statement).map(([resource, actions]) => [resource,
        actions.filter((permission) => canProjectPermission(scope, context, resource, permission)),
      ]));
      return { user, context, project, permissions };
    },
    async building(access: MessagingAccess, buildingId?: string) {
      if (!(access.permissions.buildings ?? []).includes("view")) throw new ForbiddenError("You cannot view this project's buildings.");
      const buildings = (await buildingsRepository(db).listByProject(access.project.id)).filter((building) => building.kind === "real");
      const selected = buildingId ? buildings.find((building) => building.id === buildingId) : buildings.length === 1 ? buildings[0] : undefined;
      if (!selected) throw new BadRequestError("Choose an authorized real building for this project.");
      return selected;
    },
  };
}
