import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import type { NotificationsService } from "../notifications/service.ts";
import type { RealtimeHub } from "../../lib/realtime/index.ts";
import type { ReferenceContext, ReferenceResolver } from "./references.ts";
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

export interface ChatEmailReminder {
  userId: string;
  channelId: string;
  messageCreatedAt: string;
  type: "chat_dm" | "chat_mention";
  title: string;
  projectId: string | null;
}

export interface MessagingDeps {
  notifications?: NotificationsService;
  realtime?: RealtimeHub;
  references?: ReferenceResolver;
  enqueueChatEmail?: (reminder: ChatEmailReminder) => Promise<void>;
  createActionItem?: (
    projectId: string,
    input: { title: string; description?: string | null },
    userId: string,
  ) => Promise<{ id: string }>;
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
  quotedMessageId?: string | null;
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
    quotedMessageId: row.quoted_message_id,
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

  async function attachReadReceipts(messages: Message[], channelId: string, viewerId: string): Promise<void> {
    const own = messages.filter((m) => m.authorId === viewerId && !m.deletedAt);
    if (own.length === 0) return;
    const states = await repository.memberReadStates(channelId);
    const others = states.filter((s) => s.user_id !== viewerId);
    const recipientCount = others.length;
    // A recipient has read a message when they marked the channel read at or
    // after the message was created (last_read_at is wall-clock; created_at is
    // time-ordered, so this is the reliable comparison — message ids are uuids).
    for (const message of own) {
      const readers = others.filter(
        (s) => s.last_read_at !== null && s.last_read_at >= message.createdAt,
      );
      message.recipientCount = recipientCount;
      message.readBy = readers.length;
      message.readAt = readers.length > 0
        ? readers.reduce((min, s) => (s.last_read_at! < min ? s.last_read_at! : min), readers[0]!.last_read_at!)
        : null;
    }
  }

  async function attachQuotedPreviews(messages: Message[]): Promise<void> {
    const quotedIds = [...new Set(messages.map((m) => m.quotedMessageId).filter((id): id is string => Boolean(id)))];
    if (quotedIds.length === 0) return;
    const previews = await repository.findQuotedPreviews(quotedIds);
    const byId = new Map(
      previews.map((p) => {
        const deleted = p.deleted_at !== null && p.deleted_at !== undefined;
        return [p.id, { id: p.id, authorName: p.author_name ?? null, body: deleted ? "" : p.body, deleted }];
      }),
    );
    for (const message of messages) {
      if (message.quotedMessageId) {
        message.quotedMessage = byId.get(message.quotedMessageId) ?? null;
      }
    }
  }

  async function notifyMentions(
    channelId: string,
    messageCreatedAt: string,
    mentions: MessageMention[],
    memberIds: Set<string>,
    mutedUsers: Set<string>,
    recentlyActive: Set<string>,
    projectId: string | null,
    organizationId: string | null,
    channelName: string,
    actorId: string,
    actorName: string,
  ): Promise<void> {
    if (!deps.notifications) return;
    const targets = new Set<string>();
    for (const m of mentions) {
      if (m.kind === "user" && m.userId && m.userId !== actorId && memberIds.has(m.userId)) {
        targets.add(m.userId);
      }
      if (m.kind === "here") {
        const projectTargets = projectId
          ? await repository.projectMentionUserIds(projectId)
          : [...memberIds];
        for (const userId of projectTargets) {
          if (userId !== actorId) targets.add(userId);
        }
      }
      if (m.kind === "channel") {
        const companyTargets = await repository.companyMentionUserIds({ projectId, organizationId });
        const fallbackTargets = companyTargets.length > 0 ? companyTargets : [...memberIds];
        for (const userId of fallbackTargets) {
          if (userId !== actorId) targets.add(userId);
        }
      }
    }
    for (const userId of targets) {
      if (mutedUsers.has(userId)) continue;
      const title = `${actorName} mentioned you in ${channelName}`;
      // Online users get a live desktop notification instead of the in-app
      // record, so a mention reaches them even when they're on another page.
      if (deps.realtime?.isOnline(userId)) {
        deps.realtime.publish({
          event: "notification.created",
          userId,
          data: { type: "chat_mention", title, projectId, channelName },
        });
      } else {
        void deps.notifications
          .notify(userId, "chat_mention", {
            title,
            body: "",
            projectId: projectId ?? undefined,
            emailMode: "skip",
          })
          .catch(() => undefined);
      }
      if (recentlyActive.has(userId)) continue;
      void deps
        .enqueueChatEmail?.({
          userId,
          channelId,
          messageCreatedAt,
          type: "chat_mention",
          title,
          projectId,
        })
        .catch(() => undefined);
    }
  }

  function notifyDm(
    channelId: string,
    messageCreatedAt: string,
    memberIds: string[],
    recentlyActive: Set<string>,
    mutedUsers: Set<string>,
    actorId: string,
    actorName: string,
  ): void {
    for (const userId of memberIds) {
      if (userId === actorId) continue;
      if (mutedUsers.has(userId)) continue;
      const title = `New message from ${actorName}`;
      void deps.notifications
        ?.notify(userId, "chat_dm", { title, body: "", emailMode: "skip" })
        .catch(() => undefined);
      if (recentlyActive.has(userId)) continue;
      void deps
        .enqueueChatEmail?.({ userId, channelId, messageCreatedAt, type: "chat_dm", title, projectId: null })
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

    async updateChannel(
      channelId: string,
      patch: { name?: string; topic?: string | null; archived?: boolean },
      userId: string,
    ): Promise<Channel> {
      const membership = await requireMembership(channelId, userId);
      if (membership.role !== "admin") throw new ForbiddenError("Only channel admins can update the channel");
      const dbPatch: { name?: string; topic?: string | null; archived_at?: string | null } = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.topic !== undefined) dbPatch.topic = patch.topic;
      if (patch.archived !== undefined) dbPatch.archived_at = patch.archived ? new Date().toISOString() : null;
      await repository.updateChannel(channelId, dbPatch);
      const row = await repository.findChannelForUser(channelId, userId);
      return toChannel(row!);
    },

    async removeFromProjectChannels(projectId: string, userId: string): Promise<void> {
      await repository.removeMembersForProject(projectId, userId);
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
      ctx: ReferenceContext,
      opts: { before?: string; limit?: number },
    ): Promise<Message[]> {
      await requireMembership(channelId, userId);
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
      const rows = await repository.listMessages(channelId, { before: opts.before, limit });
      const messages = rows.reverse().map(toMessage);
      if (deps.references) {
        for (const message of messages) {
          if (message.deletedAt || message.references.length === 0) continue;
          message.resolvedReferences = await deps.references.resolveMany(message.references, ctx);
        }
      }
      const reactionRows = await repository.reactionsForMessages(messages.map((m) => m.id));
      if (reactionRows.length > 0) {
        const byMessage = new Map<string, Map<string, { count: number; mine: boolean }>>();
        for (const r of reactionRows) {
          const perMsg = byMessage.get(r.message_id) ?? new Map();
          const entry = perMsg.get(r.emoji) ?? { count: 0, mine: false };
          entry.count += 1;
          if (r.user_id === userId) entry.mine = true;
          perMsg.set(r.emoji, entry);
          byMessage.set(r.message_id, perMsg);
        }
        for (const message of messages) {
          const perMsg = byMessage.get(message.id);
          if (perMsg) {
            message.reactions = [...perMsg.entries()].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
          }
        }
      }
      const replyCounts = await repository.replyCountsForMessages(messages.map((m) => m.id));
      for (const message of messages) {
        const count = replyCounts.get(message.id);
        if (count) message.replyCount = count;
      }
      await attachQuotedPreviews(messages);
      await attachReadReceipts(messages, channelId, userId);
      return messages;
    },

    async searchReferences(
      _ctx: ReferenceContext,
      projectIds: string[],
      query: string,
      types: string[] | undefined,
      limit = 15,
    ): Promise<{ type: string; id: string; label: string; projectId: string }[]> {
      if (!deps.references) return [];
      return deps.references.search(query, projectIds, types, limit);
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

      let quotedMessageId: string | null = null;
      if (input.quotedMessageId) {
        const quoted = await repository.findMessageById(input.quotedMessageId);
        if (quoted && quoted.channel_id === channelId) quotedMessageId = input.quotedMessageId;
      }

      const row = await repository.createMessage({
        id: generateId("msg"),
        channel_id: channelId,
        author_id: actor.id,
        body: input.body,
        content_html: input.contentHtml ?? null,
        parent_message_id: input.parentMessageId ?? null,
        quoted_message_id: quotedMessageId,
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
      const mutedUsers = new Set(
        members.filter((m) => m.muted || m.notify_level === "none").map((m) => m.user_id),
      );
      // Suppress chat emails for anyone who replied in this channel within the
      // last 10 minutes — they're actively in the conversation, so emailing them
      // every message would be noise.
      const activeCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const recentlyActive = new Set(
        await repository.recentlyActiveUserIds(channelId, activeCutoff),
      );
      const channelName = channelRow.name ? `#${channelRow.name}` : "a conversation";
      const withAuthor = await repository.findMessageById(row.id);
      const message = toMessage(withAuthor ?? row);
      await attachQuotedPreviews([message]);

      if (deps.realtime) {
        deps.realtime.publish({ event: "message.created", channelId, data: message });
        for (const userId of memberIds) {
          if (userId === actor.id) continue;
          deps.realtime.publish({ event: "unread.changed", userId, data: { channelId } });
        }
      }

      await notifyMentions(
        channelId,
        message.createdAt,
        input.mentions ?? [],
        new Set(memberIds),
        mutedUsers,
        recentlyActive,
        channelRow.project_id,
        channelRow.organization_id,
        channelName,
        actor.id,
        actor.name,
      );
      if (channelRow.type === "dm" || channelRow.type === "group_dm") {
        notifyDm(channelId, message.createdAt, memberIds, recentlyActive, mutedUsers, actor.id, actor.name);
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

    async toggleReaction(messageId: string, emoji: string, userId: string): Promise<void> {
      const message = await repository.findMessageById(messageId);
      if (!message) throw new NotFoundError("Message");
      await requireMembership(message.channel_id, userId);
      await repository.toggleReaction(messageId, userId, emoji);
      if (deps.realtime) {
        deps.realtime.publish({ event: "reaction.changed", channelId: message.channel_id, data: { messageId } });
      }
    },

    async listThread(rootId: string, userId: string): Promise<Message[]> {
      const root = await repository.findMessageById(rootId);
      if (!root) throw new NotFoundError("Message");
      await requireMembership(root.channel_id, userId);
      const rows = await repository.listThread(rootId);
      return rows.map(toMessage);
    },

    async pin(messageId: string, userId: string): Promise<void> {
      const message = await repository.findMessageById(messageId);
      if (!message) throw new NotFoundError("Message");
      await requireMembership(message.channel_id, userId);
      await repository.pinMessage(message.channel_id, messageId, userId);
      if (deps.realtime) {
        deps.realtime.publish({ event: "channel.updated", channelId: message.channel_id, data: { pinned: messageId } });
      }
    },

    async unpin(channelId: string, messageId: string, userId: string): Promise<void> {
      await requireMembership(channelId, userId);
      await repository.unpinMessage(channelId, messageId);
    },

    async listPinned(channelId: string, userId: string): Promise<Message[]> {
      await requireMembership(channelId, userId);
      const rows = await repository.listPinned(channelId);
      return rows.map(toMessage);
    },

    async openOrCreateDm(otherUserId: string, actorId: string): Promise<Channel> {
      if (otherUserId === actorId) throw new ForbiddenError("Cannot DM yourself");
      const existing = await repository.findDmChannel([actorId, otherUserId]);
      if (existing) {
        const withMembership = await repository.findChannelForUser(existing.id, actorId);
        return toChannel(withMembership!);
      }
      const channel = await repository.createChannel({
        id: generateId("chan"),
        type: "dm",
        name: null,
        topic: null,
        project_id: null,
        organization_id: null,
        is_private: true,
        created_by_id: actorId,
      });
      for (const userId of [actorId, otherUserId]) {
        await repository.addMember({
          id: generateId("cm"),
          channel_id: channel.id,
          user_id: userId,
          role: "member",
          added_by_id: actorId,
        });
      }
      const withMembership = await repository.findChannelForUser(channel.id, actorId);
      return toChannel(withMembership!);
    },

    async search(
      userId: string,
      query: string,
      channelId: string | undefined,
      limit = 30,
    ): Promise<Message[]> {
      if (!query.trim()) return [];
      const rows = await repository.searchMessages(userId, query.trim(), channelId, Math.min(limit, 50));
      return rows.map(toMessage);
    },

    async getMessage(messageId: string, userId: string): Promise<Message> {
      const row = await repository.findMessageById(messageId);
      if (!row) throw new NotFoundError("Message");
      await requireMembership(row.channel_id, userId);
      return toMessage(row);
    },

    async forwardToActionItem(messageId: string, userId: string): Promise<{ id: string }> {
      if (!deps.createActionItem) throw new ForbiddenError("Action items are unavailable");
      const row = await repository.findMessageById(messageId);
      if (!row || row.deleted_at) throw new NotFoundError("Message");
      await requireMembership(row.channel_id, userId);
      const channel = await repository.findChannelById(row.channel_id);
      if (!channel?.project_id) throw new ForbiddenError("Can only forward project channel messages");
      const text = (row.body ?? "").trim();
      const title = text.length > 0 ? text.slice(0, 120) : "Message from chat";
      const description = `Forwarded from chat${row.author_name ? ` (${row.author_name})` : ""}: ${text}`;
      return deps.createActionItem(channel.project_id, { title, description }, userId);
    },
  };
}

export type MessagingService = ReturnType<typeof messagingService>;
