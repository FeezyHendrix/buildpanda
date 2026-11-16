import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { agentApi, type ChannelOption } from "../api/agent";

export const agentKeys = {
  all: ["messaging-agent"] as const,
  status: () => [...agentKeys.all, "status"] as const,
  session: (userId: string, channel: ChannelOption, connectionId: string | null, projectId: string) =>
    [...agentKeys.all, "session", userId, channel.id, channel.accountId, connectionId, projectId] as const,
  tools: (userId: string, channel: ChannelOption, connectionId: string | null, projectId: string) =>
    [...agentKeys.all, "tools", userId, channel.id, channel.accountId, connectionId, projectId] as const,
};

export function useAgentStatus() {
  return useQuery({
    queryKey: agentKeys.status(),
    queryFn: ({ signal }) => agentApi.status(signal),
    retry: false,
    refetchInterval: 10_000,
  });
}

export function useAgentSession(userId: string, channel: ChannelOption, connectionId: string | null, projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.session(userId, channel, connectionId, projectId),
    queryFn: ({ signal }) => agentApi.session(projectId, connectionId, signal),
    enabled: enabled && channel.enabled && Boolean(userId) && Boolean(projectId),
    retry: false,
    refetchInterval: enabled ? 5_000 : false,
  });
}

export function useAgentMutation<T>(operation: (value: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: operation,
    onSuccess: () => client.invalidateQueries({ queryKey: agentKeys.all }),
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) client.removeQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useAgentTools(userId: string, channel: ChannelOption, connectionId: string | null, projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: agentKeys.tools(userId, channel, connectionId, projectId),
    queryFn: ({ signal }) => agentApi.tools(projectId, connectionId, signal),
    enabled: enabled && channel.enabled && Boolean(userId) && Boolean(projectId),
    retry: false,
    refetchInterval: enabled ? 10_000 : false,
  });
}
