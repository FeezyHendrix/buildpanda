import { assertOrganizationPermission, canProjectPermission, type EnrichedAccessContext } from "../../lib/authorization.ts";
import { ForbiddenError } from "../../lib/errors.ts";
import type { messagingAccessRepository } from "./access-repository.ts";

/** A socket subscription is not an enduring grant to receive future message bodies. */
export function conversationAccess(
  repository: ReturnType<typeof messagingAccessRepository>,
  loadContext: (userId: string) => Promise<EnrichedAccessContext>,
) {
  return async (channelId: string, userId: string, activeOrganizationId: string | null): Promise<boolean> => {
    const [channel, context] = await Promise.all([repository.memberChannel(channelId, userId), loadContext(userId)]);
    if (!channel) return false;
    if (channel.project_id) {
      const project = await repository.projectScope(channel.project_id);
      return !!project && canProjectPermission({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, context, "messages", "view");
    }
    const organizationId = channel.organization_id ?? activeOrganizationId;
    if (!organizationId) return false;
    try { assertOrganizationPermission(organizationId, context, "messages", "view"); return true; }
    catch (error) { if (error instanceof ForbiddenError) return false; throw error; }
  };
}
