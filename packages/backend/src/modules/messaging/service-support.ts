import { NotFoundError } from "../../lib/errors.ts";
import type { MessagingRepository } from "./repository.ts";
import type { Message, MessageMention, MessagingDeps } from "./types.ts";

export function messagingSupport(repository: MessagingRepository, deps: MessagingDeps) {
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
    messageId: string,
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
          data: { type: "chat_mention", title, projectId, channelName, ctaUrl: `/messages?channel=${channelId}&message=${messageId}` },
        });
      } else {
        void deps.notifications
          .notify(userId, "chat_mention", {
            title,
            body: "",
            projectId: projectId ?? undefined,
            ctaUrl: `/messages?channel=${channelId}&message=${messageId}`,
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
    messageId: string,
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
        ?.notify(userId, "chat_dm", { title, body: "", ctaUrl: `/messages?channel=${channelId}&message=${messageId}`, emailMode: "skip" })
        .catch(() => undefined);
      if (recentlyActive.has(userId)) continue;
      void deps
        .enqueueChatEmail?.({ userId, channelId, messageCreatedAt, type: "chat_dm", title, projectId: null })
        .catch(() => undefined);
    }
  }

  return { requireMembership, attachReadReceipts, attachQuotedPreviews, notifyMentions, notifyDm };
}
