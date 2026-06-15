import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { notificationsRepository } from "../notifications/repository.ts";
import { notificationsService } from "../notifications/service.ts";
import { messagingRepository } from "./repository.ts";
import { messagingService } from "./service.ts";
import { referenceResolver, referenceableTypes } from "./references.ts";
import type { ReferenceContext } from "./references.ts";
import type { MessageAttachment, MessageMention, MessageReference } from "./types.ts";

const channelIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const messageIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const listMessagesQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    before: { type: "string", minLength: 1, maxLength: 100 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  },
} as const;

const referenceItem = {
  type: "object",
  required: ["type", "id", "label"],
  additionalProperties: false,
  properties: {
    type: { type: "string", minLength: 1, maxLength: 40 },
    id: { type: "string", minLength: 1, maxLength: 100 },
    label: { type: "string", maxLength: 300 },
  },
} as const;

const mentionItem = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["user", "here", "channel"] },
    userId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const attachmentItem = {
  type: "object",
  required: ["fileId", "url", "name"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    url: { type: "string", minLength: 1, maxLength: 2000 },
    name: { type: "string", minLength: 1, maxLength: 300 },
    mime: { type: "string", maxLength: 200 },
    size: { type: "integer", minimum: 0 },
  },
} as const;

const sendMessageBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 8000 },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
    parentMessageId: { type: ["string", "null"], maxLength: 100 },
    references: { type: "array", maxItems: 50, items: referenceItem },
    mentions: { type: "array", maxItems: 100, items: mentionItem },
    attachments: { type: "array", maxItems: 20, items: attachmentItem },
  },
} as const;

const editMessageBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 8000 },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
  },
} as const;

const createChannelBody = {
  type: "object",
  required: ["type", "name"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["project", "org"] },
    name: { type: "string", minLength: 1, maxLength: 80 },
    projectId: { type: ["string", "null"], maxLength: 100 },
    organizationId: { type: ["string", "null"], maxLength: 100 },
    isPrivate: { type: "boolean" },
    topic: { type: ["string", "null"], maxLength: 500 },
    memberIds: { type: "array", maxItems: 200, items: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;

const membershipBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    muted: { type: "boolean" },
    notifyLevel: { type: "string", enum: ["all", "mentions", "none"] },
    lastReadMessageId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const addMembersBody = {
  type: "object",
  required: ["memberIds"],
  additionalProperties: false,
  properties: {
    memberIds: { type: "array", minItems: 1, maxItems: 200, items: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;

async function projectMemberIds(db: Knex, projectId: string): Promise<string[]> {
  const rows = await db("project_participants")
    .where({ project_id: projectId, status: "active" })
    .whereNotNull("user_id")
    .pluck<string[]>("user_id");
  return rows;
}

const messagingRoutes: FastifyPluginAsync = async (fastify) => {
  const service = messagingService(messagingRepository(fastify.db), {
    notifications: notificationsService(notificationsRepository(fastify.db)),
    realtime: fastify.realtime,
    references: referenceResolver(fastify.db),
  });

  function refCtx(request: FastifyRequest): ReferenceContext {
    return {
      userId: request.user?.id ?? "",
      orgRoles: request.orgRoles,
      projectRoles: request.projectRoles,
    };
  }

  fastify.get("/channels", async (request) => {
    const user = request.requireAuth();
    return service.listChannels(user.id);
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
      const channel = await service.createChannel(body, user.id);
      return reply.status(201).send(channel);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/channels",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectAccess(request.params.id);
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
      const orgIds = [...request.orgRoles.keys()];
      const participantProjectIds = [...request.projectRoles.keys()];
      const rows = await fastify.db("projects")
        .where(function () {
          this.where("owner_id", user.id);
          if (orgIds.length) this.orWhereIn("organization_id", orgIds);
          if (participantProjectIds.length) this.orWhereIn("id", participantProjectIds);
        })
        .pluck<string[]>("id");
      const requestedTypes = request.query.types
        ? request.query.types.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
      const valid = requestedTypes?.filter((t) => referenceableTypes().includes(t));
      return service.searchReferences(refCtx(request), rows, request.query.q, valid);
    },
  );
};

export default messagingRoutes;
