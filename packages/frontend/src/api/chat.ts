import api from "./client";
import type { Channel, ChatMessage, ChannelMemberLite } from "@/lib/project-types";

export interface SendMessageInput {
  body: string;
  parentMessageId?: string;
  quotedMessageId?: string;
  mentions?: { kind: "user" | "here" | "channel"; userId?: string }[];
  references?: { type: string; id: string; label: string }[];
  attachments?: { fileId: string; url: string; name: string; mime?: string; size?: number }[];
}

export interface ReferenceSearchResult {
  type: string;
  id: string;
  label: string;
  projectId: string;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export interface UpdateMembershipInput {
  muted?: boolean;
  notifyLevel?: "all" | "mentions" | "none";
}

export interface CreateChannelInput {
  type: "project" | "org";
  name: string;
  projectId?: string | null;
  isPrivate?: boolean;
  topic?: string | null;
}

export const chatApi = {
  getProjectChannels: (projectId: string) =>
    api.get<Channel[]>(`/projects/${projectId}/channels`).then((r) => r.data),

  getChannelMessages: (channelId: string, params?: { before?: string; limit?: number }) =>
    api.get<ChatMessage[]>(`/channels/${channelId}/messages`, { params }).then((r) => r.data),

  getChannelMembers: (channelId: string) =>
    api.get<ChannelMemberLite[]>(`/channels/${channelId}/members`).then((r) => r.data),

  sendMessage: (channelId: string, data: SendMessageInput) =>
    api.post<ChatMessage>(`/channels/${channelId}/messages`, data).then((r) => r.data),

  searchReferences: (query: string) =>
    api.get<ReferenceSearchResult[]>('/references/search', { params: { q: query } }).then((r) => r.data),

  getLinkPreview: (url: string) =>
    api.post<{ preview: LinkPreview | null }>("/link-preview", { url }).then((r) => r.data.preview),

  forwardToActionItem: (messageId: string) =>
    api.post<{ id: string }>(`/messages/${messageId}/forward-to-action-item`).then((r) => r.data),

  searchMessages: (query: string, channelId?: string) =>
    api.get<ChatMessage[]>("/search/messages", { params: { q: query, channelId } }).then((r) => r.data),

  editMessage: (messageId: string, body: string) =>
    api.patch<ChatMessage>(`/messages/${messageId}`, { body }).then((r) => r.data),

  deleteMessage: (messageId: string) =>
    api.delete<ChatMessage>(`/messages/${messageId}`).then((r) => r.data),

  markChannelRead: (channelId: string, lastReadMessageId: string) =>
    api.patch(`/channels/${channelId}/members/me`, { lastReadMessageId }).then((r) => r.data),

  toggleReaction: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/reactions`, { emoji }).then((r) => r.data),

  getPins: (channelId: string) =>
    api.get<ChatMessage[]>(`/channels/${channelId}/pins`).then((r) => r.data),

  pinMessage: (messageId: string) =>
    api.post(`/messages/${messageId}/pin`).then((r) => r.data),

  unpinMessage: (channelId: string, messageId: string) =>
    api.delete(`/channels/${channelId}/pins/${messageId}`).then((r) => r.data),

  getThread: (rootId: string) =>
    api.get<ChatMessage[]>(`/messages/${rootId}/thread`).then((r) => r.data),

  openDm: (userId: string) =>
    api.post<Channel>('/channels/dm', { userId }).then((r) => r.data),

  getAllChannels: () =>
    api.get<Channel[]>('/channels').then((r) => r.data),

  updateMembership: (channelId: string, data: UpdateMembershipInput) =>
    api.patch(`/channels/${channelId}/members/me`, data).then((r) => r.data),

  createChannel: (input: CreateChannelInput) =>
    api.post<Channel>("/channels", input).then((r) => r.data),
};
