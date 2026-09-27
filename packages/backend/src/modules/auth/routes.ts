import type { FastifyPluginAsync } from "fastify";
import { auth } from "../../lib/auth.ts";
import { clientIp, countryFromIp } from "../../lib/client-geo.ts";
import { runWithRequestContext } from "../../lib/request-context.ts";
import { invalidateAccessContext } from "../../plugins/access-cache.ts";

function toHeaders(record: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

function roleMutationPath(pathname: string): boolean {
  return pathname.endsWith("/organization/create-role") ||
    pathname.endsWith("/organization/update-role") ||
    pathname.endsWith("/organization/delete-role");
}

function bodyOrganizationId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as { organizationId?: unknown }).organizationId;
  return typeof value === "string" && value ? value : null;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `http://${request.headers.host ?? "localhost"}`,
      );

      const req = new Request(url.toString(), {
        method: request.method,
        headers: toHeaders(request.headers),
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });

      const ip = clientIp(request);
      const response = await runWithRequestContext(
        { ip, country: countryFromIp(ip) },
        () => auth.handler(req),
      );

      if (request.method === "POST" && response.ok && roleMutationPath(url.pathname)) {
        const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
        const organizationId = bodyOrganizationId(request.body) ?? session?.session.activeOrganizationId ?? null;
        if (organizationId) {
          const members = await fastify.db("member").where({ organizationId }).select<{ userId: string }[]>("userId");
          await Promise.all(members.map((member) => invalidateAccessContext(member.userId)));
        }
      }

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      const body = await response.text();
      return reply.send(body || null);
    },
  });
};

export default authRoutes;
