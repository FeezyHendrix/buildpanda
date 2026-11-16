import { buildChangeServices } from "./wiring.ts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import {
  type ChangeAction,
  type ChangeActionInput,
  type ChangeStatus,
  type CreateChangeRequestInput,
  type UpdateChangeRequestInput,
} from "./types.ts";
import { projectIdParams, crParams, listQuery, createBody, budgetLinksBody, updateBody, actionParams, actionBody, commentBody, summaryResponse } from "./route-schemas.ts";

/**
 * Does this caller hold the separate approval grant? Being able to raise and
 * price a change is not the same as being able to decide one.
 */
function holdsApproval(
  request: FastifyRequest,
  project: { id: string; owner_id: string | null; organization_id: string | null },
): boolean {
  return canProjectPermission(
    { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
    {
      userId: request.user!.id,
      orgRoles: request.orgRoles,
      orgPermissions: request.orgPermissions,
      projectRoles: request.projectRoles,
      projectSectionPermissions: request.projectSectionPermissions,
      projectGrants: request.projectGrants,
    },
    "change-requests",
    "approve",
  );
}

const changeRequestRoutes: FastifyPluginAsync = async (fastify) => {
  const { service, actions, repository } = buildChangeServices(fastify.db, fastify.queue);

  // Declared before the :changeId routes so "summary" is never read as an id.
  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/change-requests/summary",
    { schema: { params: projectIdParams, response: summaryResponse } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.summary(project.id);
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { status?: ChangeStatus } }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.list(project.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateChangeRequestInput }>(
    "/projects/:id/change-requests",
    { schema: { params: projectIdParams, body: createBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      const created = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(created);
    },
  );

  fastify.get<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.get(project.id, request.params.changeId);
    },
  );

  fastify.patch<{ Params: { id: string; changeId: string }; Body: UpdateChangeRequestInput }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams, body: updateBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      return service.update(project.id, request.params.changeId, request.body, user.id);
    },
  );

  /**
   * The only way the ladder is walked. Each action is a decision with an actor,
   * a timestamp and — for a rejection — a reason, so the register reads as the
   * negotiation it records rather than as a status someone typed.
   */
  fastify.post<{
    Params: { id: string; changeId: string; action: ChangeAction };
    Body: ChangeActionInput;
  }>(
    "/projects/:id/change-requests/:changeId/:action",
    { schema: { params: actionParams, body: actionBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      const user = request.requireAuth();
      await actions.run(project.id, request.params.changeId, request.params.action, request.body, {
        id: user.id,
        name: user.name,
        // Everyone reaching this route holds change-requests:manage, which IS
        // the approval grant; the self-decision guard only bites when a future
        // preset separates proposing from deciding.
        holdsApproval: holdsApproval(request, project),
      });
      return service.get(project.id, request.params.changeId);
    },
  );

  fastify.delete<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId",
    { schema: { params: crParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      await actions.assertRemovable(
        project.id,
        request.params.changeId,
        await repository.countReferencingRfis(request.params.changeId),
      );
      await service.remove(project.id, request.params.changeId);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string; changeId: string }; Body: { body: string } }>(
    "/projects/:id/change-requests/:changeId/comments",
    { schema: { params: crParams, body: commentBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "comments", "post");
      const user = request.requireAuth();
      const comment = await service.addComment(project.id, request.params.changeId, request.body.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(comment);
    },
  );

  fastify.get<{ Params: { id: string; changeId: string } }>(
    "/projects/:id/change-requests/:changeId/budget-links",
    { schema: { params: crParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "view");
      return service.getBudgetLinks(project.id, request.params.changeId);
    },
  );

  fastify.put<{
    Params: { id: string; changeId: string };
    Body: { links: { budgetCategoryId: string; amount: number; committed?: boolean }[] };
  }>(
    "/projects/:id/change-requests/:changeId/budget-links",
    { schema: { params: crParams, body: budgetLinksBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "change-requests", "manage");
      return service.setBudgetLinks(
        project.id,
        request.params.changeId,
        request.body.links.map((l) => ({
          budgetCategoryId: l.budgetCategoryId,
          amount: l.amount,
          committed: l.committed ?? false,
        })),
      );
    },
  );
};

export default changeRequestRoutes;
