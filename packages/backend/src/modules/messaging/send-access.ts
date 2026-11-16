import type { AuthorizationRequest } from "../../lib/authorization-request.ts";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { MessagingRepository } from "./repository.ts";
import type { MessagingAccessRepository } from "./access-repository.ts";
import type { SendMessageInput } from "./types.ts";
import { requireConversationPermission } from "./permission.ts";

export async function requireWorkspaceRecipient(request: AuthorizationRequest, repository: MessagingAccessRepository, userId: string) {
  await requireConversationPermission(request, { projectId: null, organizationId: null }, "send");
  const organizationId = request.activeOrganizationId;
  if (!organizationId || !(await repository.workspaceMember(userId, organizationId))) {
    throw new ForbiddenError("Direct messages are available to members of this workspace.");
  }
}

/** HTTP and confirmed agent actions share membership, grants and thread boundaries. */
export async function requireMessageSend(request: AuthorizationRequest, repository: MessagingRepository, channelId: string, input: SendMessageInput) {
  const channel = await repository.findChannelForUser(channelId, request.requireAuth().id);
  if (!channel) throw new NotFoundError("Channel");
  await requireConversationPermission(request, { projectId: channel.project_id, organizationId: channel.organization_id }, "send");
  if (channel.archived_at) throw new ForbiddenError("This channel is archived");
  for (const id of new Set([input.parentMessageId, input.quotedMessageId].filter((value): value is string => Boolean(value)))) {
    const message = await repository.findMessageById(id);
    if (!message || message.channel_id !== channelId || message.deleted_at) {
      throw new ForbiddenError("The message is unavailable in this conversation.");
    }
  }
  return channel;
}
