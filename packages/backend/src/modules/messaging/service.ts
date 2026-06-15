import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { RealtimeHub } from "../../lib/realtime/index.ts";
import type {
  MessagingRepository,
  NewMemberRecord,
} from "./repository.ts";
import type {
  Channel,
  ChannelRow,
  Message,
  MessageMention,
  MessageReference,
  MessageRow,
  NotifyLevel,
} from "./types.ts";

export interface MessagingDeps {
  notifications?: NotificationsService;
  realtime?: RealtimeHub;
}

export interface CreateChannelInput {
  type: "project" | "org";
  name: string;
  projectId?: string | null;
  organizationId?: string | null;
  isPrivate?: boolean;
  topic?: string | null;
  memberIds?: string[];
}

export interface SendMessageInput {
  body: string;
  contentHtml?: string | null;
  references?: MessageReference[];
  mentions?: MessageMention[];
  attachments?: { fileId: string; url: string; name: string; mime?: string; size?: number }[];
  parentMessageId?: string | null;
}

function parseJson<T>(value: T[] | string): T[] {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T[];
    } catch {
      return [];
    }
  }
  return value ?? [];
}

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    topic: row.topic,
    projectId: row.project_id,
    organizationId: row.organization_id,
    isPrivate: row.is_private,
    archivedAt: toIsoOrNull(row.archived_at),
    createdById: row.created_by_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    unreadCount: Number(row.unread_count ?? 0),
    muted: Boolean(row.muted),
    notifyLevel: (row.notify_level ?? "all") as NotifyLevel,
  };
}

function toMessage(row: MessageRow): Message {
  const deleted = row.deleted_at !== null && row.deleted_at !== undefined;
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    authorName: row.author_name ?? null,
    body: deleted ? "" : row.body,
    contentHtml: deleted ? null : row.content_html,
    parentMessageId: row.parent_message_id,
    references: deleted ? [] : parseJson<MessageReference>(row.references),
    mentions: deleted ? [] : parseJson<MessageMention>(row.mentions),
    attachments: deleted ? [] : parseJson(row.attachments),
    editedAt: toIsoOrNull(row.edited_at),
    deletedAt: toIsoOrNull(row.deleted_at),
    createdAt: toIso(row.created_at),
  };
}

export function messagingService(repository: MessagingRepository, deps: MessagingDeps = {}) {
  async function requireMembership(channelId: string, userId: string) {
    const membership = await repository.isMember(channelId, userId);
    if (!membership) throw new NotFoundError("Channel");
    return membership;
  }

  function notifyMentions(
    mentions: MessageMention[],
    memberIds: Set<string>,
    projectId: string | null,
    channelName: string,
    actorId: string,
    actorName: string,
  ): void {
    if (!deps.notifications) return;
    const targets = new Set<string>();
    for (const m of mentions) {
      if (m.kind === "user" && m.userId && m.userId !== actorId && memberIds.has(m.userId)) {
        targets.add(m.userId);
      }
    }
    for (const userId of targets) {
      if (deps.realtime?.isOnline(userId)) continue;
      void deps.notifications
        .notify(userId, "chat_mention", {
          title: `${actorName} mentioned you in ${channelName}`,
          body: "",
          projectId: projectId ?? undefined,
        })
        .catch(() => undefined);
    }
  }

  function notifyDm(
    memberIds: string[],
    actorId: string,
    actorName: string,
  ): void {
    if (!deps.notifications) return;
    for (const userId of memberIds) {
      if (userId === actorId) continue;
      void deps.notifications
        .notify(userId, "chat_dm", {
          title: `New message from ${actorName}`,
          body: "",
        })
        .catch(() => undefined);
    }
  }

  return {
    async listChannels(userId: string): Promise<Channel[]> {
      const rows = await repository.listForUser(userId);
      return rows.map(toChannel);
    },

    async listProjectChannels(projectId: string, userId: string): Promise<Channel[]> {
      const rows = await repository.listForProject(projectId, userId);
      return rows.map(toChannel);
    },

    async getChannel(channelId: string, userId: string): Promise<Channel> {
      const row = await repository.findChannelForUser(channelId, userId);
      if (!row) throw new NotFoundError("Channel");
      return toChannel(row);
    },

    async ensureProjectGeneral(
      projectId: string,
      memberIds: string[],
      actorId: string,
    ): Promise<Channel> {
      const existing = await repository.findProjectChannelByName(projectId, "general");
      if (existing) {
        const withMembership = await repository.findChannelForUser(existing.id, actorId);
        if (withMembership) return toChannel(withMembership);
        await repository.addMember({
          id: generateId("cm"),
          channel_id: existing.id,
          user_id: actorId,
          role: "member",
          added_by_id: actorId,
        });
        const refetched = await repository.findChannelForUser(existing.id, actorId);
        return toChannel(refetched!);
      }
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: "project",
        name: "general",
        topic: null,
        project_id: projectId,
        organization_id: null,
        is_private: false,
        created_by_id: actorId,
      });
      const uniqueMembers = new Set([actorId, ...memberIds]);
      for (const userId of uniqueMembers) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: userId === actorId ? "admin" : "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

    async createChannel(input: CreateChannelInput, actorId: string): Promise<Channel> {
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: input.type,
        name: input.name.trim(),
        topic: input.topic ?? null,
        project_id: input.type === "project" ? (input.projectId ?? null) : null,
        organization_id: input.type === "org" ? (input.organizationId ?? null) : null,
        is_private: input.isPrivate ?? false,
        created_by_id: actorId,
      });
      const members = new Set([actorId, ...(input.memberIds ?? [])]);
      for (const userId of members) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: userId === actorId ? "admin" : "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

    async listMessages(
      channelId: string,
      userId: string,
      opts: { before?: string; limit?: number },
    ): Promise<Message[]> {
      await requireMembership(channelId, userId);
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
      const rows = await repository.listMessages(channelId, { before: opts.before, limit });
      return rows.reverse().map(toMessage);
    },

    async sendMessage(
      channelId: string,
      input: SendMessageInput,
      actor: { id: string; name: string },
    ): Promise<Message> {
      const channelRow = await repository.findChannelById(channelId);
      if (!channelRow) throw new NotFoundError("Channel");
      await requireMembership(channelId, actor.id);
      if (channelRow.archived_at) throw new ForbiddenError("This channel is archived");

      const row = await repository.createMessage({
        id: generateId("msg"),
        channel_id: channelId,
        author_id: actor.id,
        body: input.body,
        content_html: input.contentHtml ?? null,
        parent_message_id: input.parentMessageId ?? null,
        references: JSON.stringify(input.references ?? []),
        mentions: JSON.stringify(input.mentions ?? []),
        attachments: JSON.stringify(input.attachments ?? []),
      });
      await repository.touchChannel(channelId);
      await repository.updateMembership(channelId, actor.id, {
        last_read_message_id: row.id,
        last_read_at: new Date().toISOString(),
      });

      const members = await repository.listMembers(channelId);
      const memberIds = members.map((m) => m.user_id);
      const channelName = channelRow.name ? `#${channelRow.name}` : "a conversation";
      const withAuthor = await repository.findMessageById(row.id);
      const message = toMessage(withAuthor ?? row);

      if (deps.realtime) {
        deps.realtime.publish({ event: "message.created", channelId, data: message });
        for (const userId of memberIds) {
          if (userId === actor.id) continue;
          deps.realtime.publish({ event: "unread.changed", userId, data: { channelId } });
        }
      }

      notifyMentions(
        input.mentions ?? [],
        new Set(memberIds),
        channelRow.project_id,
        channelName,
        actor.id,
        actor.name,
      );
      if (channelRow.type === "dm" || channelRow.type === "group_dm") {
        notifyDm(memberIds, actor.id, actor.name);
      }

      return message;
    },

    async editMessage(messageId: string, body: string, contentHtml: string | null, userId: string): Promise<Message> {
      const existing = await repository.findMessageById(messageId);
      if (!existing || existing.deleted_at) throw new NotFoundError("Message");
      if (existing.author_id !== userId) throw new ForbiddenError("You can only edit your own messages");
      const updated = await repository.updateMessage(messageId, {
        body,
        content_html: contentHtml,
        edited_at: new Date().toISOString(),
      });
      const message = toMessage(updated!);
      if (deps.realtime) {
        deps.realtime.publish({ event: "message.updated", channelId: existing.channel_id, data: message });
      }
      return message;
    },

    async deleteMessage(messageId: string, userId: string): Promise<Message> {
      const existing = await repository.findMessageById(messageId);
      if (!existing) throw new NotFoundError("Message");
      const membership = await repository.isMember(existing.channel_id, userId);
      if (!membership) throw new NotFoundError("Message");
      const isAuthor = existing.author_id === userId;
      const isAdmin = membership.role === "admin";
      if (!isAuthor && !isAdmin) throw new ForbiddenError("You cannot delete this message");
      const updated = await repository.updateMessage(messageId, {
        deleted_at: new Date().toISOString(),
      });
      const message = toMessage(updated!);
      if (deps.realtime) {
        deps.realtime.publish({ event: "message.deleted", channelId: existing.channel_id, data: message });
      }
      return message;
    },

    async markRead(channelId: string, userId: string, messageId: string): Promise<void> {
      await requireMembership(channelId, userId);
      await repository.updateMembership(channelId, userId, {
        last_read_message_id: messageId,
        last_read_at: new Date().toISOString(),
      });
    },

    async updateMembership(
      channelId: string,
      userId: string,
      patch: { muted?: boolean; notifyLevel?: NotifyLevel },
    ): Promise<void> {
      await requireMembership(channelId, userId);
      await repository.updateMembership(channelId, userId, {
        muted: patch.muted,
        notify_level: patch.notifyLevel,
      });
    },

    async listMembers(channelId: string, userId: string) {
      await requireMembership(channelId, userId);
      const rows = await repository.listMembers(channelId);
      return rows.map((m) => ({ id: m.user_id, name: m.name, email: m.email, role: m.role }));
    },

    async addMembers(channelId: string, memberIds: string[], actorId: string): Promise<void> {
      const membership = await requireMembership(channelId, actorId);
      if (membership.role !== "admin") throw new ForbiddenError("Only channel admins can add members");
      for (const userId of memberIds) {
        const record: NewMemberRecord = {
          id: generateId("cm"),
          channel_id: channelId,
          user_id: userId,
          role: "member",
          added_by_id: actorId,
        };
        await repository.addMember(record);
      }
    },

    async removeMember(channelId: string, targetUserId: string, actorId: string): Promise<void> {
      const membership = await requireMembership(channelId, actorId);
      if (membership.role !== "admin" && actorId !== targetUserId) {
        throw new ForbiddenError("Only channel admins can remove members");
      }
      await repository.removeMember(channelId, targetUserId);
    },
  };
}

export type MessagingService = ReturnType<typeof messagingService>;
