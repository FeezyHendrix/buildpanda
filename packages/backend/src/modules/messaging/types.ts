export type ChannelType = "project" | "org" | "dm" | "group_dm";
export type MemberRole = "admin" | "member";
export type NotifyLevel = "all" | "mentions" | "none";

export const CHANNEL_TYPES: readonly ChannelType[] = ["project", "org", "dm", "group_dm"];
export const NOTIFY_LEVELS: readonly NotifyLevel[] = ["all", "mentions", "none"];

export interface MessageReference {
  type: string;
  id: string;
  label: string;
}

export interface MessageMention {
  kind: "user" | "here" | "channel";
  userId?: string;
}

export interface MessageAttachment {
  fileId: string;
  url: string;
  name: string;
  mime?: string;
  size?: number;
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string | null;
  topic: string | null;
  projectId: string | null;
  organizationId: string | null;
  isPrivate: boolean;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  muted: boolean;
  notifyLevel: NotifyLevel;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  contentHtml: string | null;
  parentMessageId: string | null;
  references: MessageReference[];
  resolvedReferences?: {
    type: string;
    id: string;
    restricted: boolean;
    title?: string;
    status?: string | null;
    projectId?: string | null;
    url?: string;
  }[];
  mentions: MessageMention[];
  attachments: MessageAttachment[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface ChannelRow {
  id: string;
  type: ChannelType;
  name: string | null;
  topic: string | null;
  project_id: string | null;
  organization_id: string | null;
  is_private: boolean;
  archived_at: Date | string | null;
  created_by_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  unread_count?: string | number;
  muted?: boolean;
  notify_level?: NotifyLevel;
}

export interface ChannelMemberRow {
  id: string;
  channel_id: string;
  user_id: string;
  role: MemberRole;
  last_read_message_id: string | null;
  last_read_at: Date | string | null;
  muted: boolean;
  notify_level: NotifyLevel;
  added_by_id: string | null;
  created_at: Date | string;
}

export interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string | null;
  author_name?: string | null;
  body: string;
  content_html: string | null;
  parent_message_id: string | null;
  references: MessageReference[] | string;
  mentions: MessageMention[] | string;
  attachments: MessageAttachment[] | string;
  edited_at: Date | string | null;
  deleted_at: Date | string | null;
  created_at: Date | string;
}
