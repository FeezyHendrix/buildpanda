import { request } from "./client";

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
  kind: "daily_log" | "update_daily_log";
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
}

export interface AgentSession {
  connectionId: string | null;
  projectId: string;
  organizationId: string | null;
  buildings: { id: string; name: string }[];
  buildingId: string | null;
  permissions: { dailyLog?: string[] };
  messages: {
    id: string;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
    inputType?: "text" | "audio";
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
  setScope: (projectId: string, connectionId: string, buildingId: string) => request<void>(`${projectPath(projectId)}/scope`, { method: "PATCH", body: body({ connectionId, buildingId }) }),
  propose: (projectId: string, connectionId: string, text: string) => request<Proposal>(`${projectPath(projectId)}/proposals`, { method: "POST", body: body({ connectionId, text }) }),
  retryMessage: (projectId: string, messageId: string) => request<void>(`${projectPath(projectId)}/messages/${encodeURIComponent(messageId)}/retry`, { method: "POST" }),
  edit: (projectId: string, proposal: Proposal, actions: ProposalAction[]) => request<Proposal>(proposalPath(projectId, proposal.id), {
    method: "PATCH", body: body({ version: proposal.version, actions: actions.map(({ kind, payload }) => ({ kind, payload })) }),
  }),
  confirm: (projectId: string, proposal: Proposal) => request<Proposal>(`${proposalPath(projectId, proposal.id)}/confirm`, { method: "POST", body: body({ version: proposal.version }) }),
  cancel: (projectId: string, proposal: Proposal) => request<Proposal>(`${proposalPath(projectId, proposal.id)}/cancel`, { method: "POST", body: body({ version: proposal.version }) }),
};
