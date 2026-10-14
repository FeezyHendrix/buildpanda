import type { FastifyPluginAsync } from "fastify";
import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { messagingRepository } from "./repository.ts";
import { messagingService } from "./service.ts";
import { messagingAccessRepository } from "./access-repository.ts";
import { referenceResolver, referenceableTypes } from "./references.ts";
import { CHAT_EMAIL_QUEUE, CHAT_EMAIL_DELAY_MS } from "./chat-email-job.ts";
import { tasksRepository } from "../tasks/repository.ts";
import { tasksService } from "../tasks/service.ts";
import { referenceContext as refCtx } from "./request-context.ts";
import type { MessageAttachment, MessageMention, MessageReference } from "./types.ts";

import { channelIdParams, messageIdParams, listMessagesQuery, sendMessageBody, editMessageBody, createChannelBody, membershipBody, addMembersBody } from "./route-schemas.ts";
import { filterConversations, registerMessagingAccess, requireConversationPermission } from "./access.ts";

async function projectMemberIds(db: Knex, projectId: string): Promise<string[]> {
  const rows = await db("project_participants")
    .where({ project_id: projectId, status: "active" })
    .whereNotNull("user_id")
    .pluck<string[]>("user_id");
  return rows;
}

const messagingRoutes: FastifyPluginAsync = async (fastify) => {
  registerMessagingAccess(fastify);
  const service = messagingService(messagingRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
    realtime: fastify.realtime,
    references: referenceResolver(fastify.db),
    enqueueChatEmail: (reminder) =>
      fastify.queue.enqueue(CHAT_EMAIL_QUEUE, "send", reminder, {
        delayMs: CHAT_EMAIL_DELAY_MS,
        jobId: `${reminder.channelId}:${reminder.userId}`,
      }),
    createTask: async (projectId, input, userId) => {
      const tasks = tasksService(tasksRepository(fastify.db), {
        notifications: notificationsService(notificationsRepository(fastify.db), fastify.queue),
      });
      const created = await tasks.createTask(projectId, { title: input.title, description: input.description }, userId);
      return { id: created.id };
    },
  });


  fastify.get("/channels", async (request) => {
    const user = request.requireAuth();
    return filterConversations(request, await service.listChannels(user.id));
  });

  fastify.post<{
    Body: {
      type: "project" | "org";
      name: string;
      projectId?: string | null;
      organizationId?: string | null;
      isPrivate?: boolean;
      topic?: string | null;
      memberIds?: string[];
    };
  }>(
    "/channels",
    { schema: { body: createChannelBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const body = request.body;
      if (body.type === "project") {
        if (!body.projectId) throw new BadRequestError("projectId is required for a project channel");
        await request.requireProjectWrite(body.projectId);
      } else {
        request.requireOrgPermission("project", "create");
      }
      await requireConversationPermission(request, { projectId: body.projectId ?? null, organizationId: body.organizationId ?? null }, "send");
      const channel = await service.createChannel(body, user.id);
      return reply.status(201).send(channel);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/channels",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "messages", "view");
      const user = request.requireAuth();
      const members = await projectMemberIds(fastify.db, project.id);
      if (project.owner_id) members.push(project.owner_id);
      await service.ensureProjectGeneral(project.id, members, user.id);
      return service.listProjectChannels(project.id, user.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/channels/:id",
    { schema: { params: channelIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.getChannel(request.params.id, user.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/channels/:id/members",
    { schema: { params: channelIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.listMembers(request.params.id, user.id);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { name?: string; topic?: string | null; archived?: boolean } }>(
    "/channels/:id",
    {
      schema: {
        params: channelIdParams,
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            topic: { type: ["string", "null"], maxLength: 500 },
            archived: { type: "boolean" },
          },
        },
      },
    },
    async (request) => {
      const user = request.requireAuth();
      return service.updateChannel(request.params.id, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { memberIds: string[] } }>(
    "/channels/:id/members",
    { schema: { params: channelIdParams, body: addMembersBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      await service.addMembers(request.params.id, request.body.memberIds, user.id);
      return reply.status(204).send();
    },
  );

  fastify.delete<{ Params: { id: string; userId: string } }>(
    "/channels/:id/members/:userId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "userId"],
          additionalProperties: false,
          properties: { id: { type: "string", minLength: 1 }, userId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const user = request.requireAuth();
      await service.removeMember(request.params.id, request.params.userId, user.id);
      return reply.status(204).send();
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { muted?: boolean; notifyLevel?: "all" | "mentions" | "none"; lastReadMessageId?: string } }>(
    "/channels/:id/members/me",
    { schema: { params: channelIdParams, body: membershipBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      if (request.body.lastReadMessageId) {
        await service.markRead(request.params.id, user.id, request.body.lastReadMessageId);
      }
      if (request.body.muted !== undefined || request.body.notifyLevel !== undefined) {
        await service.updateMembership(request.params.id, user.id, {
          muted: request.body.muted,
          notifyLevel: request.body.notifyLevel,
        });
      }
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: number } }>(
    "/channels/:id/messages",
    { schema: { params: channelIdParams, querystring: listMessagesQuery } },
    async (request) => {
      const user = request.requireAuth();
      return service.listMessages(request.params.id, user.id, refCtx(request), {
        before: request.query.before,
        limit: request.query.limit,
      });
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: {
      body: string;
      contentHtml?: string | null;
      parentMessageId?: string | null;
      quotedMessageId?: string | null;
      references?: MessageReference[];
      mentions?: MessageMention[];
      attachments?: MessageAttachment[];
    };
  }>(
    "/channels/:id/messages",
    { schema: { params: channelIdParams, body: sendMessageBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const message = await service.sendMessage(request.params.id, request.body, {
        id: user.id,
        name: user.name,
      });
      return reply.status(201).send(message);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { body: string; contentHtml?: string | null } }>(
    "/messages/:id",
    { schema: { params: messageIdParams, body: editMessageBody } },
    async (request) => {
      const user = request.requireAuth();
      return service.editMessage(
        request.params.id,
        request.body.body,
        request.body.contentHtml ?? null,
        user.id,
      );
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/messages/:id",
    { schema: { params: messageIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.deleteMessage(request.params.id, user.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { emoji: string } }>(
    "/messages/:id/reactions",
    {
      schema: {
        params: messageIdParams,
        body: {
          type: "object",
          required: ["emoji"],
          additionalProperties: false,
          properties: { emoji: { type: "string", minLength: 1, maxLength: 32 } },
        },
      },
    },
    async (request, reply) => {
      const user = request.requireAuth();
      await service.toggleReaction(request.params.id, request.body.emoji, user.id);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/messages/:id/thread",
    { schema: { params: messageIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.listThread(request.params.id, user.id);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/messages/:id/pin",
    { schema: { params: messageIdParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      await service.pin(request.params.id, user.id);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/messages/:id/forward-to-task",
    { schema: { params: messageIdParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const result = await service.forwardToTask(request.params.id, user.id);
      return reply.status(201).send(result);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/channels/:id/pins",
    { schema: { params: channelIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.listPinned(request.params.id, user.id);
    },
  );

  fastify.delete<{ Params: { id: string; messageId: string } }>(
    "/channels/:id/pins/:messageId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "messageId"],
          additionalProperties: false,
          properties: { id: { type: "string", minLength: 1 }, messageId: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const user = request.requireAuth();
      await service.unpin(request.params.id, request.params.messageId, user.id);
      return reply.status(204).send();
    },
  );

  fastify.post<{ Body: { userId: string } }>(
    "/channels/dm",
    {
      schema: {
        body: {
          type: "object",
          required: ["userId"],
          additionalProperties: false,
          properties: { userId: { type: "string", minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const user = request.requireAuth();
      const channel = await service.openOrCreateDm(request.body.userId, user.id);
      return reply.status(201).send(channel);
    },
  );

  fastify.get<{ Querystring: { q?: string; channelId?: string } }>(
    "/search/messages",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", minLength: 1, maxLength: 200 },
            channelId: { type: "string", minLength: 1, maxLength: 100 },
          },
        },
      },
    },
    async (request) => {
      const user = request.requireAuth();
      if (!request.query.q) return [];
      const allowed = new Set((await filterConversations(request, await service.listChannels(user.id))).map((channel) => channel.id));
      if (request.query.channelId && !allowed.has(request.query.channelId)) return [];
      return (await service.search(user.id, request.query.q, request.query.channelId)).filter((message) => allowed.has(message.channelId));
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/messages/:id",
    { schema: { params: messageIdParams } },
    async (request) => {
      const user = request.requireAuth();
      return service.getMessage(request.params.id, user.id);
    },
  );

  fastify.get<{ Querystring: { q?: string; types?: string } }>(
    "/references/search",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", minLength: 1, maxLength: 200 },
            types: { type: "string", maxLength: 300 },
          },
        },
      },
    },
    async (request) => {
      const user = request.requireAuth();
      if (!request.query.q) return [];
      const rows = await messagingAccessRepository(fastify.db).accessibleProjectIds(user.id, [...request.orgRoles.keys()], [...request.projectRoles.keys()]);
      const requestedTypes = request.query.types
        ? request.query.types.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
      const valid = requestedTypes?.filter((t) => referenceableTypes().includes(t));
      return service.searchReferences(refCtx(request), rows, request.query.q, valid);
    },
  );
};

export default messagingRoutes;
