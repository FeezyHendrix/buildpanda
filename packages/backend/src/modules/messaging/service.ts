import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { ReferenceContext } from "./references.ts";
import type { MessagingRepository, NewMemberRecord } from "./repository.ts";
import type { Message, MessagingDeps, SendMessageInput, NotifyLevel } from "./types.ts";
import { toMessage } from "./mappers.ts";
import { messagingSupport } from "./service-support.ts";
import { channelService } from "./channel-service.ts";
export type { ChatEmailReminder, MessagingDeps, CreateChannelInput, SendMessageInput } from "./types.ts";

export function messagingService(repository: MessagingRepository, deps: MessagingDeps = {}) {
  const { requireMembership, attachReadReceipts, attachQuotedPreviews, notifyMentions, notifyDm } = messagingSupport(repository, deps);
  return {
    ...channelService(repository),
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
      ctx: ReferenceContext,
      projectIds: string[],
      query: string,
      types: string[] | undefined,
      limit = 15,
    ): Promise<{ type: string; id: string; label: string; projectId: string }[]> {
      if (!deps.references) return [];
      return deps.references.search(query, projectIds, types, limit, ctx);
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
        message.id,
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
        notifyDm(channelId, message.createdAt, message.id, memberIds, recentlyActive, mutedUsers, actor.id, actor.name);
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

    async forwardToTask(messageId: string, userId: string): Promise<{ id: string }> {
      if (!deps.createTask) throw new ForbiddenError("Tasks are unavailable");
      const row = await repository.findMessageById(messageId);
      if (!row || row.deleted_at) throw new NotFoundError("Message");
      await requireMembership(row.channel_id, userId);
      const channel = await repository.findChannelById(row.channel_id);
      if (!channel?.project_id) throw new ForbiddenError("Can only forward project channel messages");
      const text = (row.body ?? "").trim();
      const title = text.length > 0 ? text.slice(0, 120) : "Message from chat";
      const description = `Forwarded from chat${row.author_name ? ` (${row.author_name})` : ""}: ${text}`;
      return deps.createTask(channel.project_id, { title, description }, userId);
    },
  };
}

export type MessagingService = ReturnType<typeof messagingService>;
