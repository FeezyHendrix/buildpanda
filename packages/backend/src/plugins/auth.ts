import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { auth } from "../lib/auth.js";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(
          request.url,
          `http://${request.headers.host ?? "localhost:3000"}`
        );

        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value) {
            headers.append(key, Array.isArray(value) ? value.join(", ") : value);
          }
        }

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        const body = await response.text();
        return reply.send(body || null);
      } catch (error) {
        fastify.log.error(error, "Authentication error");
        return reply.status(500).send({
          error: "Internal authentication error",
        });
      }
    },
  });
};

export default fp(authPlugin, { name: "auth" });
