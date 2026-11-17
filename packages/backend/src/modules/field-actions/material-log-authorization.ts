import type { Knex } from "knex";
import { assertCanAccessProject, assertProjectPermission } from "../../lib/authorization.ts";
import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import { FeatureDisabledError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { featureFlagsRepository } from "../feature-flags/repository.ts";
import { featureFlagsService } from "../feature-flags/service.ts";
import { requireMaterialLogPermission } from "../materials-ledger/permissions.ts";
import { projectsRepository } from "../projects/repository.ts";
import { fieldActionsRepository } from "./repository.ts";
import type { MaterialLogAuthorizationDeps, MaterialLogScope } from "./material-types.ts";
import type { FieldActor } from "./types.ts";

export function materialLogAuthorizer(deps: MaterialLogAuthorizationDeps) {
  return async (actor: FieldActor, projectId: string, entryType: "IN" | "USED"): Promise<MaterialLogScope> => {
    const [user, context] = await Promise.all([deps.userById(actor.userId), deps.loadAccess(actor.userId)]);
    if (!user || (user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now()))) {
      throw new ForbiddenError("This account cannot perform field actions");
    }
    const request: AuthorizationRequest = {
      ...context, activeOrganizationId: actor.organizationId,
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
    const project = await request.requireProjectPermission(projectId, "project", "view");
    await requireMaterialLogPermission(request, projectId, entryType);
    if (!(await deps.isEnabled())) throw new FeatureDisabledError("commercial.materialsLedger", "Materials ledger");
    return { project, actor: user };
  };
}

export async function authorizeMaterialLogScope(db: Knex, actor: FieldActor, projectId: string, entryType: "IN" | "USED"): Promise<MaterialLogScope> {
  const access = accessContextRepository(db);
  const flags = featureFlagsService(featureFlagsRepository(db));
  return materialLogAuthorizer({
    userById: fieldActionsRepository(db).userById,
    loadAccess: async (id) => resolveAccessContext(id, await access.load(id)),
    projectById: projectsRepository(db).findById,
    isEnabled: async () => (await Promise.all([
      flags.isEnabled("commercial.materialsLedger"), flags.isEnabled("commercial.materialsEquipment"),
    ])).every(Boolean),
  })(actor, projectId, entryType);
}
