import type { Knex } from "knex";
import { runQueries } from "../../lib/run-queries.ts";
import { assertCanAccessProject, assertProjectPermission } from "../../lib/authorization.ts";
import { FeatureDisabledError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { requireProjectFileReferences } from "../files/attachment-access.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { featureFlagsRepository } from "../feature-flags/repository.ts";
import { featureFlagsService } from "../feature-flags/service.ts";
import { fieldActionsRepository } from "./repository.ts";
import type { FieldActor } from "./types.ts";
import type { FieldToolContext, FieldToolInput } from "./tool-types.ts";

export async function fieldToolContext(db: Knex, input: FieldToolInput, actor: FieldActor, queue?: QueueManager): Promise<FieldToolContext> {
  const [user, loaded] = await runQueries(db, [() => fieldActionsRepository(db).userById(actor.userId), () => accessContextRepository(db).load(actor.userId)]);
  if (!user || (user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now()))) throw new ForbiddenError("This account cannot perform field actions.");
  const access = resolveAccessContext(actor.userId, loaded);
  const request: FieldToolContext["request"] = {
    ...access, activeOrganizationId: actor.organizationId, requireAuth: () => ({ id: user.id }),
    async requireProjectAccess(projectId) {
      if (projectId !== input.projectId) throw new ForbiddenError("This action belongs to another selected project.");
      const project = await projectsRepository(db).findById(projectId);
      if (!project) throw new NotFoundError("Project");
      if (project.organization_id !== actor.organizationId) throw new ForbiddenError("The project belongs to another workspace.");
      assertCanAccessProject({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, access);
      return project;
    },
    async requireProjectPermission(projectId, resource, action) {
      const project = await this.requireProjectAccess(projectId);
      assertProjectPermission({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, access, resource, action);
      return project;
    },
  };
  const project = await request.requireProjectPermission(input.projectId, "project", "view");
  return { db, queue, actor, user, request, project, buildingId: input.buildingId,
    async requireFeature(key, label = key) {
      if (!(await featureFlagsService(featureFlagsRepository(db)).isEnabled(key))) throw new FeatureDisabledError(key, label);
    },
    requireFiles: (payload) => requireProjectFileReferences({ ...request, body: payload }, input.projectId, filesRepository(db), fileAccessRepository(db)),
  };
}
