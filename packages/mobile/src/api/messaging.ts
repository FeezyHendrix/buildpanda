import { channelRequirement } from "@/lib/messaging-access";
import { features, messagingAccess } from "@/lib/feature-access";
import { projectAccess, requireAccess, requireCurrentAccess } from "@/lib/project-access-store";
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

async function authorizedChannel(id: string, write = false): Promise<Channel> {
  const ticket = requireAccess(projectAccess.getState().scope?.projectId ?? "", messagingAccess);
  const channel = await request<Channel>(channelPath(id));
  requireCurrentAccess(ticket);
  requireAccess(ticket.scope!.projectId, channelRequirement(channel, write));
  if (write && channel.archivedAt) throw new Error("This conversation is read only.");
  return channel;
}
async function inChannel<T>(id: string, write: boolean, run: () => Promise<T>) {
  const channel = await authorizedChannel(id, write);
  const ticket = requireAccess(projectAccess.getState().scope?.projectId ?? "", channelRequirement(channel, write));
  const data = await run();
  requireCurrentAccess(ticket);
  return data;
}
async function authorizedMessage(id: string) {
  const message = await request<Message>(messagePath(id));
  await authorizedChannel(message.channelId);
  return message;
}
export const messagingApi = {
  channels: () => request<Channel[]>("/channels"),
  projectChannels: (projectId: string) => request<Channel[]>(`/projects/${encodeURIComponent(projectId)}/channels`),
  channel: (id: string) => authorizedChannel(id),
  members: (id: string) => inChannel(id, false, () => request<ChannelMember[]>(`${channelPath(id)}/members`)),
  messages: (id: string, before?: string) => inChannel(id, false, () => request<Message[]>(`${channelPath(id)}/messages?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`)),
  message: authorizedMessage,
  thread: async (id: string) => {
    const root = await authorizedMessage(id);
    return inChannel(root.channelId, false, () => request<Message[]>(`${messagePath(id)}/thread`));
  },
  send: (id: string, body: string, parentMessageId?: string) => inChannel(id, true, () => request<Message>(`${channelPath(id)}/messages`, {
    method: "POST", body: JSON.stringify({ body, ...(parentMessageId ? { parentMessageId } : {}) }),
  })),
  markRead: (id: string, lastReadMessageId: string) => inChannel(id, false, () => request<void>(`${channelPath(id)}/members/me`, {
    method: "PATCH", body: JSON.stringify({ lastReadMessageId }),
  })),
  openDm: (userId: string) => {
    requireAccess(projectAccess.getState().scope?.projectId ?? "", features.workspaceMessages.actions.create);
    return request<Channel>("/channels/dm", { method: "POST", body: JSON.stringify({ userId }) });
  },
};
