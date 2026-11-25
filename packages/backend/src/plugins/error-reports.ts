import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  captureError,
  withErrorContext,
} from "../modules/error-reports/runtime.ts";
import type {
  ErrorContext,
  ErrorReportPluginOptions,
} from "../modules/error-reports/types.ts";

export function requestErrorContext(request: FastifyRequest): ErrorContext {
  const params = request.params as
    | { id?: string; projectId?: string }
    | undefined;
  const route = request.routeOptions.url ?? request.url;
  return {
    kind: "http",
    requestId: request.id,
    method: request.method,
    route,
    userId: request.user?.id,
    organizationId:
      request.activeOrganizationId &&
      request.orgRoles?.has(request.activeOrganizationId)
        ? request.activeOrganizationId
        : undefined,
    projectId: route.startsWith("/projects/")
      ? (params?.projectId ?? params?.id)
      : undefined,
  };
}
const errorReportsPlugin: FastifyPluginAsync<ErrorReportPluginOptions> = async (
  app,
  options,
) => {
  const capture = options.capture ?? captureError;
  app.addHook("onRequest", (request, _reply, done) =>
    withErrorContext(() => requestErrorContext(request), done),
  );
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Request-ID", request.id);
    return payload;
  });
  const reported = new WeakSet<FastifyRequest>();
  app.addHook("onError", async (request, reply, error) => {
    if (request.routeOptions.url === "/error-reports") return;
    reported.add(request);
    const status = error.statusCode ?? 500;
    capture(error, {
      ...requestErrorContext(request),
      status,
      durationMs: Math.round(reply.elapsedTime),
    });
  });
  app.addHook("onResponse", async (request, reply) => {
    if (
      reply.statusCode < 400 ||
      reported.has(request) ||
      request.routeOptions.url === "/error-reports"
    )
      return;
    capture(new Error(`HTTP ${reply.statusCode} response`), {
      ...requestErrorContext(request),
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });
};
export default fp(errorReportsPlugin, { name: "error-reports" });
