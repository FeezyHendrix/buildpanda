import type { FastifyPluginAsync } from "fastify";
import { reportingService } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const reportingRoutes: FastifyPluginAsync = async (fastify) => {
  const service = reportingService(fastify.db);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/reporting/snapshot",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      reply.header("cache-control", "private, max-age=60");
      return service.buildSnapshot(project.id);
    },
  );
};

export default reportingRoutes;
