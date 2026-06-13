import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { auth } from "../lib/auth.ts";
import { config } from "../config/index.ts";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.ts";
import { hasPermission } from "../lib/permissions.ts";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    orgRoles: ReadonlyMap<string, string>;
    projectRoles: ReadonlyMap<string, string>;
    activeOrganizationId: string | null;
    requireAuth(): AuthUser;
    requireAdmin(): AuthUser;
    requireOrgScope(): string;
    /** Verifies org membership AND that the member's role has the given permission. */
    requireOrgPermission(resource: string, action: string): string;
  }
}

interface MemberRoleRow {
  organizationId: string;
  role: string;
}

interface ParticipantRoleRow {
  project_id: string;
  role: string;
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
  fastify.decorateRequest("activeOrganizationId", null);
  fastify.decorateRequest("requireAuth", function requireAuth(this: FastifyRequest) {
    if (!this.user) {
      throw new UnauthorizedError();
    }
    return this.user;
  });
  fastify.decorateRequest("requireAdmin", function requireAdmin(this: FastifyRequest) {
    if (!this.user) {
      throw new UnauthorizedError();
    }
    if (this.user.role !== "admin") {
      throw new ForbiddenError("Admin access required");
    }
    return this.user;
  });
  fastify.decorateRequest("requireOrgScope", function requireOrgScope(this: FastifyRequest) {
    if (!this.user) throw new UnauthorizedError();
    const orgId = this.activeOrganizationId;
    if (!orgId || !this.orgRoles.has(orgId)) {
      throw new ForbiddenError("No active organization");
    }
    return orgId;
  });
  fastify.decorateRequest(
    "requireOrgPermission",
    function requireOrgPermission(this: FastifyRequest, resource: string, action: string) {
      if (!this.user) throw new UnauthorizedError();
      const orgId = this.activeOrganizationId;
      if (!orgId || !this.orgRoles.has(orgId)) {
        throw new ForbiddenError("No active organization");
      }
      const role = this.orgRoles.get(orgId) ?? "";
      if (!hasPermission(role, resource, action)) {
        throw new ForbiddenError(
          `Your role does not allow you to ${action} ${resource}`,
        );
      }
      return orgId;
    },
  );

  fastify.addHook("preHandler", async (request) => {
    request.orgRoles = new Map<string, string>();
    request.projectRoles = new Map<string, string>();
    if (request.url.startsWith("/api/auth/")) return;

    try {
      const session = await auth.api.getSession({ headers: toHeaders(request.headers) });
      if (session?.user) {
        const email = session.user.email;
        let role = (session.user as { role?: string }).role ?? "user";

        // Bootstrap: auto-promote allowlisted emails to the global admin role.
        if (role !== "admin" && config.adminEmails.includes(email.toLowerCase())) {
          await fastify.db("user").where({ id: session.user.id }).update({ role: "admin" });
          role = "admin";
        }

        request.user = {
          id: session.user.id,
          name: session.user.name,
          email,
          emailVerified: session.user.emailVerified,
          image: session.user.image ?? null,
          role,
        };
        request.activeOrganizationId = session.session.activeOrganizationId ?? null;
        const rows = await fastify.db<MemberRoleRow>("member")
          .where({ userId: session.user.id })
          .select("organizationId", "role");
        request.orgRoles = new Map(rows.map((row) => [row.organizationId, row.role]));

        const participantRows = await fastify.db<ParticipantRoleRow>("project_participants")
          .where({ user_id: session.user.id, status: "active" })
          .select("project_id", "role");
        request.projectRoles = new Map(participantRows.map((row) => [row.project_id, row.role]));
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
