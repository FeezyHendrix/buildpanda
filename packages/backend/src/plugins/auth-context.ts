import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { auth } from "../lib/auth.ts";
import { config } from "../config/index.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../lib/errors.ts";
import {
  BUILTIN_ROLES,
  mapAllows,
  resolvePermissionMap,
  type PermissionMap,
} from "../lib/permissions.ts";
import {
  assertCanAccessProject,
  assertCanModifyProject,
  assertProjectPermission,
} from "../lib/authorization.ts";
import type { ProjectRow } from "../modules/projects/types.ts";

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
    orgPermissions: ReadonlyMap<string, PermissionMap>;
    projectRoles: ReadonlyMap<string, string>;
    activeOrganizationId: string | null;
    requireAuth(): AuthUser;
    requireAdmin(): AuthUser;
    requireOrgScope(): string;
    /** Verifies org membership AND that the member's role has the given permission. */
    requireOrgPermission(resource: string, action: string): string;
    /** Loads a project by id and asserts the caller can read it (owner, org member, or active participant). */
    requireProjectAccess(id: string): Promise<ProjectRow>;
    /** Loads a project by id and asserts the caller can write to it (owner or non-viewer org member). */
    requireProjectWrite(id: string): Promise<ProjectRow>;
    /** Loads a project by id and asserts the caller has a specific resource:action capability. */
    requireProjectPermission(id: string, resource: string, action: string): Promise<ProjectRow>;
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

interface OrgRoleRow {
  organizationId: string;
  role: string;
  permission: string;
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

  async function loadProject(this: FastifyRequest, id: string): Promise<ProjectRow> {
    const project = await fastify.db<ProjectRow>("projects").where({ id }).first();
    if (!project) throw new NotFoundError("Project");
    return project;
  }
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
      const perms = this.orgPermissions?.get(orgId);
      if (!perms || !mapAllows(perms, resource, action)) {
        throw new ForbiddenError(
          `Your role does not allow you to ${action} ${resource}`,
        );
      }
      return orgId;
    },
  );

  fastify.decorateRequest(
    "requireProjectAccess",
    async function requireProjectAccess(this: FastifyRequest, id: string): Promise<ProjectRow> {
      const user = this.requireAuth();
      const project = await loadProject.call(this, id);
      assertCanAccessProject(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: this.orgRoles, projectRoles: this.projectRoles },
      );
      return project;
    },
  );

  fastify.decorateRequest(
    "requireProjectWrite",
    async function requireProjectWrite(this: FastifyRequest, id: string): Promise<ProjectRow> {
      const user = this.requireAuth();
      const project = await loadProject.call(this, id);
      assertCanModifyProject(
        { ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: this.orgRoles },
      );
      return project;
    },
  );

  fastify.decorateRequest(
    "requireProjectPermission",
    async function requireProjectPermission(
      this: FastifyRequest,
      id: string,
      resource: string,
      action: string,
    ): Promise<ProjectRow> {
      const user = this.requireAuth();
      const project = await loadProject.call(this, id);
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: this.orgRoles, projectRoles: this.projectRoles, orgPermissions: this.orgPermissions },
        resource,
        action,
      );
      return project;
    },
  );

  fastify.addHook("preHandler", async (request) => {
    request.orgRoles = new Map<string, string>();
    request.orgPermissions = new Map<string, PermissionMap>();
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

        // Pre-resolve effective permission maps for each org the user belongs to.
        // Skips the custom-role DB query when all roles are built-in (common path).
        const allBuiltin = rows.every((r) => BUILTIN_ROLES.has(r.role));
        const orgIds = rows.map((r) => r.organizationId);

        const customRows: OrgRoleRow[] = !allBuiltin && orgIds.length
          ? await fastify.db<OrgRoleRow>("organizationRole")
              .whereIn("organizationId", orgIds)
              .select("organizationId", "role", "permission")
          : [];

        const byOrg = new Map<string, OrgRoleRow[]>();
        for (const r of customRows) {
          const list = byOrg.get(r.organizationId);
          if (list) list.push(r);
          else byOrg.set(r.organizationId, [r]);
        }

        request.orgPermissions = new Map(
          rows.map((r) => [
            r.organizationId,
            resolvePermissionMap(r.role, byOrg.get(r.organizationId) ?? []),
          ]),
        );

        const participantRows = await fastify.db<ParticipantRoleRow>("project_participants")
          .where({ user_id: session.user.id, status: "active" })
          .select("project_id", "role");
        request.projectRoles = new Map(participantRows.map((row) => [row.project_id, row.role]));
      }
    } catch (error) {
      request.log.warn({ err: error }, "Failed to resolve auth session");
    }

    // Global default-deny: all routes require authentication unless explicitly public.
    if (!request.user) {
      const { method, url } = request;
      const isPublic =
        (method === "GET" && url === "/healthz") ||
        (method === "GET" && url.startsWith("/static/")) ||
        (method === "GET" && /^\/proposals\/public\/[^/?]+$/.test(url)) ||
        (method === "POST" && /^\/proposals\/public\/[^/?]+\/respond/.test(url)) ||
        (method === "GET" && /^\/project-invites\/[^/?]+$/.test(url)) ||
        (method === "GET" && /^\/share\/[^/?]+(\/file)?$/.test(url)) ||
        (method === "POST" && url === "/leads/consultation");
      if (!isPublic) throw new UnauthorizedError();
    }
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
  dependencies: ["database"],
});
