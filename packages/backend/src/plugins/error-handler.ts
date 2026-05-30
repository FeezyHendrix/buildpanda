import type { FastifyError, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { isAppError } from "../lib/errors.ts";

interface ErrorPayload {
  error: string;
  code: string;
  details?: unknown;
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: "Route not found",
      code: "route_not_found",
    } satisfies ErrorPayload);
  });

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    if (isAppError(error)) {
      request.log.warn(
        { code: error.code, statusCode: error.statusCode },
        error.message,
      );
      const body: ErrorPayload = {
        error: error.message,
        code: error.code,
      };
      if (error.details !== undefined) body.details = error.details;
      return reply.status(error.statusCode).send(body);
    }

    if (error.validation) {
      request.log.warn({ validation: error.validation }, "Validation error");
      return reply.status(400).send({
        error: "Invalid request",
        code: "validation_failed",
        details: error.validation,
      } satisfies ErrorPayload);
    }

    request.log.error({ err: error }, "Unhandled error");
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : error.message,
      code: "internal_error",
    } satisfies ErrorPayload);
  });
};

export default fp(errorHandlerPlugin, { name: "error-handler" });
