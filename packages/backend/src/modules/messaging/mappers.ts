import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import type { Channel, ChannelRow, Message, MessageRow, MessageMention, MessageReference, NotifyLevel } from "./types.ts";

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

export function toChannel(row: ChannelRow): Channel {
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

export function toMessage(row: MessageRow): Message {
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
