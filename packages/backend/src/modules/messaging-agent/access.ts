import type { Knex } from "knex";
import { canProjectPermission, assertProjectPermission } from "../../lib/authorization.ts";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../lib/errors.ts";
import { statement } from "../../lib/permissions.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { featureFlagsRepository } from "../feature-flags/repository.ts";
import { featureFlagsService } from "../feature-flags/service.ts";
import { messagingAgentAccessRepository } from "./access-repository.ts";
import { messagingCapabilities } from "./policy.ts";
import type { MessagingAccess, MessagingFeatures, MessagingProjectOption } from "./management-types.ts";

export function messagingAgentAccess(db: Knex) {
  const repo = messagingAgentAccessRepository(db), contextRepo = accessContextRepository(db);
  async function actor(userId: string) {
    const user = await repo.user(userId);
    if (!user || (user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now()))) {
      throw new UnauthorizedError("This account is unavailable. Sign in again to reconnect Messaging.");
    }
    return { user, context: resolveAccessContext(userId, await contextRepo.load(userId)) };
  }
  async function features(): Promise<MessagingFeatures> {
    const flags = featureFlagsService(featureFlagsRepository(db));
    const { flags: settings } = await flags.getSettings();
    const enabled = Object.fromEntries(settings.map((flag) => [flag.key, flag.enabled]));
    return { dailyLogs: enabled["quality.dailyLogs"] === true, materialLogs: enabled["commercial.materialsLedger"] === true && enabled["commercial.materialsEquipment"] === true, enabled };
  }
  const workspacePermissions = (context: Awaited<ReturnType<typeof actor>>["context"], organizationId: string | null) =>
    Object.fromEntries([...(organizationId ? context.orgPermissions.get(organizationId) ?? new Map<string, Set<string>>() : new Map<string, Set<string>>())].map(([resource, actions]) => [resource, [...actions]]));
  function permissions(scope: { id: string; ownerId: string | null; organizationId: string | null }, context: Awaited<ReturnType<typeof actor>>["context"]) {
    return Object.fromEntries(Object.entries(statement).map(([resource, actions]) => [resource,
      actions.filter((action) => canProjectPermission(scope, context, resource, action)),
    ]));
  }
  return {
    actor,
    async projects(userId: string): Promise<MessagingProjectOption[]> {
      const [{ context }, enabled] = await Promise.all([actor(userId), features()]);
      return (await repo.candidates(context)).filter((project) => {
        const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
        const capabilities = messagingCapabilities(permissions(scope, context), enabled, workspacePermissions(context, project.organization_id));
        return canProjectPermission(scope, context, "project", "view") && (capabilities.read || capabilities.capture);
      }).map((project) => ({ id: project.id, name: project.name, organizationId: project.organization_id }));
    },
    async project(userId: string, projectId: string, action?: "view" | "create"): Promise<MessagingAccess> {
      const [{ user, context }, enabled] = await Promise.all([actor(userId), features()]);
      const project = await repo.project(projectId);
      if (!project) throw new NotFoundError("Project");
      const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
      assertProjectPermission(scope, context, "project", "view");
      const effective = permissions(scope, context), workspace = workspacePermissions(context, project.organization_id), capabilities = messagingCapabilities(effective, enabled, workspace);
      if (!(action === "create" ? capabilities.capture : action === "view" ? capabilities.read : capabilities.read || capabilities.capture)) throw new ForbiddenError("You cannot use the enabled field tools on this project.");
      return { user, context, project, permissions: effective, workspacePermissions: workspace, features: enabled, capabilities };
    },
    async building(access: MessagingAccess, buildingId?: string | null) {
      if (buildingId === null) return null;
      if (!access.permissions.buildings?.includes("view")) {
        if (!buildingId) return null;
        throw new ForbiddenError("You cannot view this project's buildings.");
      }
      const buildings = (await buildingsRepository(db).listByProject(access.project.id)).filter((building) => building.kind === "real");
      const selected = buildingId ? buildings.find((building) => building.id === buildingId) : buildings.length === 1 ? buildings[0] : undefined;
      if (!selected && !buildingId) return null;
      if (!selected) throw new BadRequestError("Choose an authorized real building for this project.");
      return selected;
    },
  };
}
