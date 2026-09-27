import type { FastifyPluginAsync } from "fastify";
import { applyToEstimateService } from "./apply-to-estimate-service.ts";
import { applyToEstimateBody, sessionParams } from "./apply-to-estimate-schemas.ts";
import type { ApplyToEstimateBody } from "./types.ts";

// The route is the permission check and the schema; the locks, the drift checks
// and the write belong to the service.
const applyToEstimateRoutes: FastifyPluginAsync = async (fastify) => {
  const service = applyToEstimateService(fastify.db);

  fastify.post<{ Params: { sessionId: string }; Body: ApplyToEstimateBody }>(
    "/precon/sessions/:sessionId/apply-to-estimate",
    { schema: { params: sessionParams, body: applyToEstimateBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "apply");
      return service.run(request.params.sessionId, orgId, request.body);
    },
  );
};

export default applyToEstimateRoutes;
