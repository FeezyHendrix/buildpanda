import type { FastifyInstance } from "fastify";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { messagingRepository } from "./repository.ts";
import { messagingAccessRepository } from "./access-repository.ts";
import { requireConversationPermission } from "./permission.ts";
import { fileAccessRepository } from "../files/access-repository.ts";
import { filesRepository } from "../files/repository.ts";
import { requireProjectFileReferences } from "../files/attachment-access.ts";
import { requireMessageSend, requireWorkspaceRecipient } from "./send-access.ts";
import type { SendMessageInput } from "./types.ts";
export { filterConversations, requireConversationPermission } from "./permission.ts";

export function registerMessagingAccess(fastify: FastifyInstance) {
  const repository = messagingRepository(fastify.db);
  const accessRepository = messagingAccessRepository(fastify.db);
  const files = filesRepository(fastify.db);
  const fileAccess = fileAccessRepository(fastify.db);
  fastify.addHook("preHandler", async (request) => {
    const route = request.routeOptions.url ?? "";
    const user = request.requireAuth();
    if (route === "/channels/dm") {
      const targetId = (request.body as { userId: string }).userId;
      await requireWorkspaceRecipient(request, accessRepository, targetId);
      return;
    }
    if (route === "/channels/:id/messages" && request.method === "POST") {
      const channel = await requireMessageSend(request, repository, (request.params as { id: string }).id, request.body as SendMessageInput);
      await requireProjectFileReferences(request, channel.project_id ?? undefined, files, fileAccess);
      return;
    }
    let channelId: string | undefined;
    const params = request.params as { id?: string };
    if (route.startsWith("/channels/:id")) channelId = params.id;
    else if (route.startsWith("/messages/:id")) {
      const message = await repository.findMessageById(params.id!);
      if (!message) throw new NotFoundError("Message");
      channelId = message.channel_id;
    }
    if (!channelId) return;
    const channel = await repository.findChannelForUser(channelId, user.id);
    if (!channel) throw new NotFoundError("Channel");
    const action = request.method === "GET" || route === "/channels/:id/members/me" ? "view" : "send";
    await requireConversationPermission(request, { projectId: channel.project_id, organizationId: channel.organization_id }, action);
    if (request.method === "POST") {
      const body = request.body as { parentMessageId?: string; lastReadMessageId?: string; attachments?: { fileId: string }[] } | undefined;
      const referencedId = body?.parentMessageId ?? body?.lastReadMessageId;
      if (referencedId) {
        const referenced = await repository.findMessageById(referencedId);
        if (!referenced || referenced.channel_id !== channelId) throw new ForbiddenError("The message belongs to another conversation.");
      }
    }
    if (["POST", "PATCH", "PUT"].includes(request.method)) {
      await requireProjectFileReferences(request, channel.project_id ?? undefined, files, fileAccess);
    }
    if (route.endsWith("/forward-to-task")) {
      if (!channel.project_id) throw new ForbiddenError();
      await request.requireProjectPermission(channel.project_id, "tasks", "add");
    }
  });
}
