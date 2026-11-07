import type { FastifyPluginAsync } from "fastify";
import { canProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { isCompanyCaller } from "../rfis/caller.ts";
import { attentionRepository } from "./repository.ts";
import { attentionService } from "./service.ts";
import { ATTENTION_KINDS, type AttentionKind } from "./types.ts";

// The permission each kind needs: an item the caller cannot open is not returned.
const RESOURCE: Record<AttentionKind, string> = {
  rfi: "rfis",
  approval: "approvals",
  change_request: "change-requests",
  task: "tasks",
  inspection: "inspections",
  permit: "permits",
  key_date: "key-dates",
};

const query = {
  type: "object",
  additionalProperties: false,
  properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
} as const;

const attentionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = attentionService(attentionRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>(
    "/projects/:id/attention-areas",
    { schema: { params: projectIdParams, querystring: query } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
      const user = request.requireAuth();
      const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
      const ctx = {
        userId: user.id,
        orgRoles: request.orgRoles,
        projectRoles: request.projectRoles,
        orgPermissions: request.orgPermissions,
        projectSectionPermissions: request.projectSectionPermissions,
        projectGrants: request.projectGrants,
      };
      const kinds = ATTENTION_KINDS.filter((k) => canProjectPermission(scope, ctx, RESOURCE[k], "view"));
      return service.feed(project.id, kinds, !isCompanyCaller(request, project), request.query.limit ?? 10);
    },
  );
};

export default attentionRoutes;
