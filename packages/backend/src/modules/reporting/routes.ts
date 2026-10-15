import type { FastifyPluginAsync } from "fastify";
import { reportingService } from "./service.ts";
import { canReadReporting } from "./access.ts";
import { requestAccessContext } from "../../lib/authorization-request.ts";
import { ForbiddenError } from "../../lib/errors.ts";

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
      if (!canReadReporting({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, requestAccessContext(request))) {
        throw new ForbiddenError("This whole-project report requires access to all of its source records.");
      }
      reply.header("cache-control", "no-store");
      return service.buildSnapshot(project.id);
    },
  );
};

export default reportingRoutes;
