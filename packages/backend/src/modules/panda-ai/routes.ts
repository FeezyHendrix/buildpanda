import type { FastifyPluginAsync } from "fastify";
import {
  assertCanAccessProject,
  assertCanModifyProject,
} from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { projectsRepository } from "../projects/repository.ts";
import { pandaAiRepository } from "./repository.ts";
import { pandaAiService } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const pandaAiRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = pandaAiService(pandaAiRepository(fastify.db), fastify.queue);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/ai/insights",
    { schema: { params: projectIdParams } },
    async (request) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanAccessProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      return { insight: await service.getLatest(project.id) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/analyze",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModifyProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles },
      );
      const insight = await service.trigger(project.id, user.id);
      return reply.status(202).send({ insight });
    },
  );
};

export default pandaAiRoutes;
