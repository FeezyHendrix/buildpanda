import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { auth, ensureUserOrganization } from "../lib/auth.ts";
import { config } from "../config/index.ts";
import { enterLlmContext } from "../lib/llm-context.ts";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../lib/errors.ts";
import {
  mapAllows,
  type PermissionMap,
} from "../lib/permissions.ts";
import {
  assertCanAccessProject,
  assertCanModifyProject,
  assertProjectPermission,
  type ProjectSectionPermissions,
} from "../lib/authorization.ts";
import type { ProjectRow } from "../modules/projects/types.ts";
import { accessContextRepository } from "../modules/access-context/repository.ts";
import { resolveAccessContext } from "../modules/access-context/service.ts";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
}

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;
const lastActivityWrites = new Map<string, number>();

// Throttled to one write per user per window — a per-request UPDATE would not
// scale under load.
function touchLastActivity(db: import("knex").Knex, userId: string): void {
  const now = Date.now();
  const last = lastActivityWrites.get(userId);
  if (last && now - last < ACTIVITY_THROTTLE_MS) return;
  lastActivityWrites.set(userId, now);
  void db("user")
    .where({ id: userId })
    .update({ last_activity_at: new Date() })
    .catch(() => lastActivityWrites.delete(userId));
}

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    orgRoles: ReadonlyMap<string, string>;
    orgPermissions: ReadonlyMap<string, PermissionMap>;
    projectRoles: ReadonlyMap<string, string>;
    projectSectionPermissions: ReadonlyMap<string, ProjectSectionPermissions>;
    projectGrants: ReadonlyMap<string, Record<string, readonly string[]>>;
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

  const accessRepository = accessContextRepository(fastify.db);
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
        {
          userId: user.id,
          orgRoles: this.orgRoles,
          projectRoles: this.projectRoles,
          orgPermissions: this.orgPermissions,
          projectSectionPermissions: this.projectSectionPermissions,
        },
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
    request.projectSectionPermissions = new Map<string, ProjectSectionPermissions>();
    request.projectGrants = new Map<string, Record<string, readonly string[]>>();
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
        let { memberRows, customRoleRows, participantRows } = await fastify.accessCache.load(
          session.user.id,
          () => accessRepository.load(session.user.id),
        );

        const sessionOrgId = session.session.activeOrganizationId ?? null;
        let activeOrganizationId =
          sessionOrgId && memberRows.some((row) => row.organizationId === sessionOrgId)
            ? sessionOrgId
            : memberRows[0]?.organizationId ?? null;
        if (!activeOrganizationId) {
          activeOrganizationId = await ensureUserOrganization(session.user.id, session.user.name);
          await fastify.accessCache.invalidate(session.user.id);
          memberRows = [{ organizationId: activeOrganizationId, role: "owner" }];
          customRoleRows = [];
          participantRows = [];
        }
        request.activeOrganizationId = activeOrganizationId;

        if (activeOrganizationId && activeOrganizationId !== sessionOrgId) {
          await fastify.db("session")
            .where({ id: session.session.id })
            .update({ activeOrganizationId });
        }

        enterLlmContext({
          orgId: request.activeOrganizationId ?? undefined,
          userId: session.user.id,
          source: "request",
        });

        touchLastActivity(fastify.db, session.user.id);

        const resolved = resolveAccessContext(session.user.id, { memberRows, customRoleRows, participantRows });
        request.orgRoles = resolved.orgRoles;
        request.orgPermissions = resolved.orgPermissions;
        request.projectRoles = resolved.projectRoles ?? new Map();
        request.projectSectionPermissions = resolved.projectSectionPermissions ?? new Map();
        request.projectGrants = resolved.projectGrants ?? new Map();
      }
    } catch (error) {
      request.log.warn({ err: error }, "Failed to resolve auth session");
    }

    // Global default-deny: all routes require authentication unless explicitly public.
    if (!request.user) {
      const { method, url } = request;
      const isPublic =
        (method === "GET" && url === "/healthz") ||
        (method === "GET" && url === "/maintenance") ||
        // the public half of the payload key; clients fetch it before signing in
        (method === "GET" && url === "/crypto/payload-key") ||
        (method === "GET" && url.startsWith("/static/")) ||
        (method === "GET" && url === "/ws") ||
        (method === "GET" && /^\/public\/invoices\/[^/?]+(\/pdf)?$/.test(url)) ||
        (method === "GET" && /^\/proposals\/public\/[^/?]+$/.test(url)) ||
        (method === "GET" && /^\/proposals\/public\/[^/?]+\/files\/[^/?]+$/.test(url)) ||
        (method === "POST" && /^\/proposals\/public\/[^/?]+\/respond/.test(url)) ||
        (method === "GET" && /^\/project-invites\/[^/?]+$/.test(url)) ||
        // An org invitation reaches someone who has no account yet, so there is
        // no session to check: the opaque invitation id is the credential, as
        // with the project-invite link above. Reading it returns only the org
        // name, invited email and role; declining only moves pending -> rejected.
        (method === "GET" && /^\/invitations\/[^/?]+(\?|$)/.test(url)) ||
        (method === "POST" && /^\/invitations\/[^/?]+\/decline(\?|$)/.test(url)) ||
        (method === "GET" && /^\/share\/[^/?]+(\/file)?$/.test(url)) ||
        (method === "POST" && /^\/rfi-reply\/[^/?]+$/.test(url)) ||
        (method === "POST" && url === "/leads/consultation") ||
        (method === "POST" && url === "/leads/question") ||
        // OTA: the app checks for updates before anyone signs in, so the
        // manifest and its assets cannot sit behind a session. Publishing is
        // exempt from the session gate but guarded by its own bearer token.
        (method === "GET" && /^\/ota\/manifest(\?|$)/.test(url)) ||
        (method === "GET" && /^\/ota\/assets\/[^/?]+\/[^/?]+$/.test(url)) ||
        (method === "POST" && url === "/ota/publish");
      if (!isPublic) throw new UnauthorizedError();
    }
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
  dependencies: ["database", "access-cache"],
});
