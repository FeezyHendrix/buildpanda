import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config/index.ts";
import { ForbiddenError } from "../../lib/errors.ts";
import { errorSink } from "./runtime.ts";
import { acceptedResponse, errorReportBody } from "./schemas.ts";
import type { ErrorReportRouteOptions, FrontendErrorBody } from "./types.ts";

const errorReportRoutes: FastifyPluginAsync<ErrorReportRouteOptions> = async (
  app,
  options,
) => {
  const service = options.service ?? errorSink,
    origins = options.origins ?? config.http.corsOrigins;
  app.post<{ Body: FrontendErrorBody }>(
    "/error-reports",
    {
      bodyLimit: 48_000,
      config: { rateLimit: { max: 30, timeWindow: 60_000 } },
      schema: { body: errorReportBody, response: acceptedResponse },
    },
    async (request, reply) => {
      const origin = request.headers.origin;
      // Pre-login errors are useful, but a browser may submit only from a configured app origin.
      if (origin ? !origins.includes(origin) : !request.user)
        throw new ForbiddenError("This origin cannot send error reports.");
      const organizationId =
        request.activeOrganizationId &&
        request.orgRoles?.has(request.activeOrganizationId)
          ? request.activeOrganizationId
          : undefined;
      const entries =
        "reports" in request.body ? request.body.reports : [request.body];
      let id: string | undefined;
      for (const entry of entries)
        id = service.frontend(entry, {
          userId: request.user?.id,
          organizationId,
        });
      return reply.code(202).send({ accepted: true, id: id ?? null });
    },
  );
};
export default errorReportRoutes;
