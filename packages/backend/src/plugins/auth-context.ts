import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { auth } from "../lib/auth.ts";
import { UnauthorizedError } from "../lib/errors.ts";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    requireAuth(): AuthUser;
  }
}

function toHeaders(record: FastifyRequest["headers"]): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

const authContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("user", null);
  fastify.decorateRequest("requireAuth", function requireAuth(this: FastifyRequest) {
    if (!this.user) {
      throw new UnauthorizedError();
    }
    return this.user;
  });

  fastify.addHook("preHandler", async (request) => {
    if (request.url.startsWith("/api/auth/")) return;

    try {
      const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
      if (session?.user) {
        request.user = {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
          image: session.user.image ?? null,
        };
      }
    } catch (error) {
      request.log.warn({ err: error }, "Failed to resolve auth session");
    }
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
  dependencies: ["database"],
});
