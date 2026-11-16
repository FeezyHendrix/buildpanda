import type { Knex } from "knex";
import { assertCanAccessProject, assertProjectPermission } from "../../lib/authorization.ts";
import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import { BadRequestError, FeatureDisabledError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import { featureFlagsRepository } from "../feature-flags/repository.ts";
import { featureFlagsService } from "../feature-flags/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { fieldActionsRepository } from "./repository.ts";
import type { DailyLogAuthorizationDeps, DailyLogScope, FieldActor } from "./types.ts";

export function dailyLogAuthorizer(deps: DailyLogAuthorizationDeps) {
  return async (actor: FieldActor, projectId: string, explicitBuildingId?: string): Promise<DailyLogScope> => {
    const [user, context] = await Promise.all([deps.userById(actor.userId), deps.loadAccess(actor.userId)]);
    if (!user || (user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now()))) {
      throw new ForbiddenError("This account cannot perform field actions");
    }
    const request: AuthorizationRequest = {
      ...context,
      activeOrganizationId: actor.organizationId,
      requireAuth: () => ({ id: user.id }),
      async requireProjectAccess(id) {
        const project = await deps.projectById(id);
        if (!project) throw new NotFoundError("Project");
        if (project.organization_id !== actor.organizationId) throw new ForbiddenError("The project belongs to another workspace");
        assertCanAccessProject({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, context);
        return project;
      },
      async requireProjectPermission(id, resource, action) {
        const project = await this.requireProjectAccess(id);
        assertProjectPermission({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, context, resource, action);
        return project;
      },
    };
    const project = await request.requireProjectPermission(projectId, "dailyLog", "create");
    if (!(await deps.isEnabled())) throw new FeatureDisabledError("quality.dailyLogs", "Daily logs");
    const buildingId = explicitBuildingId ?? await deps.soleRealBuildingId(projectId);
    if (!buildingId) throw new BadRequestError("buildingId is required for a multi-building project");
    await deps.assertBuilding(projectId, buildingId);
    const role = context.projectRoles?.get(projectId) ??
      (project.organization_id ? context.orgRoles.get(project.organization_id) : undefined) ?? "member";
    return { project, buildingId, request, author: { id: user.id, name: user.name, role } };
  };
}

/** Resolve current grants from the database; browser workspace fallbacks do not apply to workers. */
export async function authorizeDailyLogScope(db: Knex, actor: FieldActor, projectId: string, buildingId?: string): Promise<DailyLogScope> {
  const access = accessContextRepository(db);
  const buildings = buildingsRepository(db);
  return dailyLogAuthorizer({
    userById: fieldActionsRepository(db).userById,
    loadAccess: async (id) => resolveAccessContext(id, await access.load(id)),
    projectById: projectsRepository(db).findById,
    isEnabled: () => featureFlagsService(featureFlagsRepository(db)).isEnabled("quality.dailyLogs"),
    assertBuilding: buildingsService(buildings).assertRealBuilding,
    soleRealBuildingId: buildings.soleRealBuildingId,
  })(actor, projectId, buildingId);
}
