import type { Channel, ChannelMember, Message } from "../api/messaging.ts";

export const MESSAGE_LIMIT = 8000;
export const MESSAGE_PAGE_SIZE = 50;

export function conversationName(channel: Channel | undefined, members: readonly ChannelMember[], ownerId: string | undefined): string {
  if (!channel) return "Conversation";
  if (channel.type === "dm" || channel.type === "group_dm") {
    return channel.name || members.filter((member) => member.id !== ownerId).map((member) => member.name || member.email).join(", ") || "Direct message";
  }
  return channel.name || "general";
}

export function visibleChannels(all: readonly Channel[], project: readonly Channel[], projectId: string | undefined, organizationId: string | undefined): Channel[] {
  return [...new Map([...all, ...project].map((channel) => [channel.id, channel])).values()]
    .filter((channel) => !channel.archivedAt && (
      channel.type === "dm" || channel.type === "group_dm" ||
      (channel.type === "project" && channel.projectId === projectId) ||
      (channel.type === "org" && channel.organizationId === organizationId)
    ))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Newer snapshots win, including edits and deletion tombstones. */
export function mergeMessages(older: readonly Message[], newest: readonly Message[]): Message[] {
  return [...new Map([...older, ...newest].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function messageDraftKey(ownerId: string | undefined, organizationId: string | undefined, channelId: string, threadId?: string): string {
  return `buildpanda_message_draft_${JSON.stringify([ownerId ?? null, organizationId ?? null, channelId, threadId ?? null])}`;
}

export function isSendableMessage(body: string): boolean {
  return body.trim().length > 0 && body.length <= MESSAGE_LIMIT;
}
