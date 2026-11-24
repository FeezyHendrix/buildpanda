import api from "./client";

export interface MessagingChannel {
  id: string;
  accountId: string;
  enabled: boolean;
}

export interface MessagingStatus {
  userId: string;
  enabled: boolean;
  projects: { id: string; organizationId: string | null }[];
  channels: MessagingChannel[];
  connections: {
    id: string;
    channel: string;
    accountId: string;
    selectedScope: { projectId: string; buildingId: string | null } | null;
  }[];
}

export interface MessagingLink {
  code: string;
  expiresAt: string;
  connectUrl: string | null;
}

export const messagingAgentApi = {
  status: (signal?: AbortSignal) => api.get<MessagingStatus>("/messaging-agent/status", { signal }).then((response) => response.data),
  link: (channel: MessagingChannel, projectId: string, buildingId: string | null) =>
    api.post<MessagingLink>("/messaging-agent/link", { channel: channel.id, accountId: channel.accountId, projectId, buildingId }).then((response) => response.data),
};
