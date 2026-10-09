import { request } from "./client";

export interface Channel {
  id: string;
  type: "project" | "org" | "dm" | "group_dm";
  name: string | null;
  topic: string | null;
  projectId: string | null;
  organizationId: string | null;
  isPrivate: boolean;
  archivedAt: string | null;
  unreadCount: number;
  muted: boolean;
  updatedAt: string;
}

export interface ChannelMember {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "member";
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  parentMessageId: string | null;
  quotedMessage?: { id: string; authorName: string | null; body: string; deleted: boolean } | null;
  attachments: { fileId: string; url: string; name: string; mime?: string; size?: number }[];
  resolvedReferences?: { type: string; id: string; restricted: boolean; title?: string }[];
  reactions?: { emoji: string; count: number; mine: boolean }[];
  replyCount?: number;
  readAt?: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

const channelPath = (id: string) => `/channels/${encodeURIComponent(id)}`;
const messagePath = (id: string) => `/messages/${encodeURIComponent(id)}`;

export const messagingApi = {
  channels: () => request<Channel[]>("/channels"),
  projectChannels: (projectId: string) => request<Channel[]>(`/projects/${encodeURIComponent(projectId)}/channels`),
  channel: (id: string) => request<Channel>(channelPath(id)),
  members: (id: string) => request<ChannelMember[]>(`${channelPath(id)}/members`),
  messages: (id: string, before?: string) => request<Message[]>(`${channelPath(id)}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`),
  message: (id: string) => request<Message>(messagePath(id)),
  thread: (id: string) => request<Message[]>(`${messagePath(id)}/thread`),
  send: (id: string, body: string, parentMessageId?: string) => request<Message>(`${channelPath(id)}/messages`, {
    method: "POST", body: JSON.stringify({ body, ...(parentMessageId ? { parentMessageId } : {}) }),
  }),
  markRead: (id: string, lastReadMessageId: string) => request<void>(`${channelPath(id)}/members/me`, {
    method: "PATCH", body: JSON.stringify({ lastReadMessageId }),
  }),
  openDm: (userId: string) => request<Channel>("/channels/dm", { method: "POST", body: JSON.stringify({ userId }) }),
};
