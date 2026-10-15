import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import type { FastifyRequest } from "fastify";
import { assertOrganizationPermission } from "../../lib/authorization.ts";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { Channel } from "./types.ts";

export async function requireConversationPermission(request: AuthorizationRequest, channel: Pick<Channel, "projectId" | "organizationId">, action: "view" | "send") {
  if (channel.projectId) {
    await request.requireProjectPermission(channel.projectId, "messages", "view");
    if (action === "send") await request.requireProjectPermission(channel.projectId, "messages", "send");
    return;
  }
  const organizationId = channel.organizationId ?? request.activeOrganizationId;
  if (!organizationId) throw new ForbiddenError("Choose a workspace to use messages.");
  const context = { userId: request.requireAuth().id, orgRoles: request.orgRoles, orgPermissions: request.orgPermissions };
  assertOrganizationPermission(organizationId, context, "messages", "view");
  if (action === "send") assertOrganizationPermission(organizationId, context, "messages", "send");
}

/** Lists and direct IDs use the same guard; membership remains a second boundary. */
export async function filterConversations(request: FastifyRequest, channels: Channel[]) {
  const results = await Promise.all(channels.map(async (channel) => {
    try { await requireConversationPermission(request, channel, "view"); return channel; }
    catch (error) { if (error instanceof ForbiddenError || error instanceof NotFoundError) return null; throw error; }
  }));
  return results.filter((channel): channel is Channel => channel !== null);
}
