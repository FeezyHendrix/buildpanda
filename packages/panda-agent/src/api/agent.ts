import { request } from "./client";
import type { ToolCatalog, UploadedFile } from "./tool-types";

export interface ProjectOption {
  id: string;
  name: string;
  organizationId: string | null;
}

export interface Scope {
  projectId: string;
  buildingId: string | null;
}

export interface ChannelOption {
  id: string;
  label: string;
  accountId: string;
  enabled: boolean;
}

export interface AgentConnection {
  id: string;
  channel: string;
  accountId: string;
  channelLabel: string;
  linkedAt: string;
  selectedScope: Scope | null;
}

export interface AgentStatus {
  userId: string;
  enabled: boolean;
  channels: ChannelOption[];
  connections: AgentConnection[];
  projects: ProjectOption[];
}

export interface ProposalAction {
  kind: string;
  title: string;
  payload: Record<string, unknown>;
  missing?: string[];
}

export interface Proposal {
  id: string;
  version: number;
  status: "draft" | "confirmed" | "completed" | "cancelled" | "failed";
  title: string;
  summary: string;
  actions: ProposalAction[];
  createdAt: string;
  result?: { recordId?: string; message?: string };
  capabilities: { edit: boolean; confirm: boolean; cancel: boolean };
  clarification?: string | null;
  artifacts?: DocumentArtifact[];
}

export interface DocumentArtifact {
  kind: "document";
  projectId: string;
  documentId: string;
  versionId: string;
  fileName: string;
  mimeType: string;
  apiPath?: string;
  url?: string;
  download: boolean;
}

export interface AgentCapabilities {
  capture: boolean;
  read: boolean;
  dailyLogCreate: boolean;
  materialReceipt: boolean;
  materialUsage: boolean;
  actions?: Record<string, boolean>;
}

export interface AgentSession {
  connectionId: string | null;
  projectId: string;
  organizationId: string | null;
  buildings: { id: string; name: string }[];
  buildingId: string | null;
  permissions: Record<string, string[]>;
  capabilities: AgentCapabilities;
  messages: {
    id: string;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
    inputType?: "text" | "audio" | "attachment";
    status?: "received" | "processing" | "processed" | "failed";
    retryable?: boolean;
  }[];
  proposals: Proposal[];
}

export interface LinkCode {
  code: string;
  expiresAt: string;
  connectUrl: string | null;
}

const projectPath = (id: string) => `/messaging-agent/projects/${encodeURIComponent(id)}`;
const proposalPath = (projectId: string, id: string) => `${projectPath(projectId)}/proposals/${encodeURIComponent(id)}`;
const body = (value: unknown) => JSON.stringify(value);

export const agentApi = {
  status: (signal?: AbortSignal) => request<AgentStatus>("/messaging-agent/status", { signal }),
  session: (projectId: string, connectionId: string | null, signal?: AbortSignal) => request<AgentSession>(`${projectPath(projectId)}/session${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`, { signal }),
  link: (channel: ChannelOption, scope: Scope) => request<LinkCode>("/messaging-agent/link", { method: "POST", body: body({ channel: channel.id, accountId: channel.accountId, ...scope }) }),
  unlink: (connectionId: string) => request<void>(`/messaging-agent/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }),
  setScope: (projectId: string, connectionId: string, buildingId: string | null) => request<void>(`${projectPath(projectId)}/scope`, { method: "PATCH", body: body({ connectionId, buildingId }) }),
  tools: (projectId: string, connectionId: string | null, signal?: AbortSignal) => request<ToolCatalog>(`${projectPath(projectId)}/tools${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`, { signal }),
  propose: (projectId: string, connectionId: string, text: string) => request<Proposal | { kind: "answer"; answer: string }>(`${projectPath(projectId)}/proposals`, { method: "POST", body: body({ connectionId, text }) }),
  uploadFile: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("file", file);
    return request<UploadedFile>("/files", { method: "POST", body: form, signal: AbortSignal.timeout(180_000) });
  },
  uploadMessage: (projectId: string, connectionId: string, file: File, text: string) => {
    const form = new FormData();
    form.append("connectionId", connectionId);
    if (text.trim()) form.append("text", text.trim());
    form.append("file", file);
    return request<{ messageId: string; file: UploadedFile }>(`${projectPath(projectId)}/messages/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(180_000) });
  },
  fileUrl: (fileId: string) => request<{ url: string }>(`/files/${encodeURIComponent(fileId)}/url`).then((value) => value.url),
  fileMetadata: (fileId: string) => request<UploadedFile>(`/files/${encodeURIComponent(fileId)}`),
  retryMessage: (projectId: string, messageId: string) => request<void>(`${projectPath(projectId)}/messages/${encodeURIComponent(messageId)}/retry`, { method: "POST" }),
  edit: (projectId: string, proposal: Proposal, actions: ProposalAction[]) => request<Proposal>(proposalPath(projectId, proposal.id), {
    method: "PATCH", body: body({ version: proposal.version, actions: actions.map(({ kind, payload }) => ({ kind, payload })) }),
  }),
  confirm: (projectId: string, proposal: Proposal) => request<Proposal>(`${proposalPath(projectId, proposal.id)}/confirm`, { method: "POST", body: body({ version: proposal.version }) }),
  cancel: (projectId: string, proposal: Proposal) => request<Proposal>(`${proposalPath(projectId, proposal.id)}/cancel`, { method: "POST", body: body({ version: proposal.version }) }),
};
