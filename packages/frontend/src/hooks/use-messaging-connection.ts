import { useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagingAgentApi } from "@/api/messaging-agent";
import { useSession } from "@/stores/auth";
import { useActiveOrganizationId } from "@/hooks/use-organization";
import { useBuildings } from "@/hooks/use-buildings";
import { participantKeys, useProjectAccess } from "@/hooks/use-participants";
import { messagingConnectionKeys } from "@/hooks/query-keys";
import { canConnectMessaging, channelConnectUrl, connectionChannel, type MessagingChannelOption } from "@/lib/messaging-connection";

export function useMessagingConnection(projectId: string, buildingId: string | undefined, option: MessagingChannelOption) {
  const client = useQueryClient();
  const session = useSession();
  const organizationId = useActiveOrganizationId() ?? null;
  const userId = session.data?.user.id ?? "";
  const access = useProjectAccess(projectId);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const permitted = online && !session.isPending && Boolean(userId) && !access.isError && !access.isStale && canConnectMessaging(access.data);
  const current = useRef({ projectId, buildingId, userId, organizationId, permitted });
  current.current = { projectId, buildingId, userId, organizationId, permitted };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function requireCurrent(scope: typeof current.current) {
    const active = current.current;
    const state = client.getQueryState(participantKeys.access(projectId));
    if (!mounted.current || !navigator.onLine || !active.permitted || active.projectId !== scope.projectId || active.buildingId !== scope.buildingId || active.userId !== scope.userId ||
      active.organizationId !== scope.organizationId || state?.isInvalidated || state?.error || state?.data !== access.data || !canConnectMessaging(access.data)) {
      throw new Error(`Project access changed. Reopen this project before connecting ${option.label}.`);
    }
  }
  const status = useQuery({
    queryKey: messagingConnectionKeys.status(userId, organizationId, projectId, access.data?.permissions),
    queryFn: async ({ signal }) => {
      const scope = current.current;
      requireCurrent(scope);
      const result = await messagingAgentApi.status(signal);
      requireCurrent(scope);
      return result;
    },
    enabled: permitted, retry: false, gcTime: 0,
    refetchInterval: permitted ? 5_000 : false,
    refetchOnWindowFocus: "always", refetchOnReconnect: "always",
  });
  const channel = permitted && !status.isError ? connectionChannel(status.data, userId, projectId, option.id) : undefined;
  const canViewBuildings = access.data?.permissions?.buildings?.includes("view") === true;
  const buildings = useBuildings(projectId, Boolean(channel) && canViewBuildings);
  const realBuildings = channel && canViewBuildings && !buildings.isError ? (buildings.data ?? []).filter((building) => building.kind === "real") : [];
  const selectedBuilding = realBuildings.find((building) => building.id === buildingId) ?? (realBuildings.length === 1 ? realBuildings[0] : undefined);
  const needsBuilding = realBuildings.length > 1 && !selectedBuilding;
  const buildingsReady = !access.data?.permissions?.buildings?.includes("view") || buildings.isSuccess;
  const connected = Boolean(channel && status.data?.connections.some((connection) => connection.channel === channel.id && connection.accountId === channel.accountId &&
    connection.selectedScope?.projectId === projectId && connection.selectedScope.buildingId === (selectedBuilding?.id ?? null)));

  const connect = useMutation({
    gcTime: 0,
    onError: (error) => {
      if (isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
        void client.invalidateQueries({ queryKey: participantKeys.access(projectId) });
      }
    },
    mutationFn: async () => {
      const scope = current.current;
      requireCurrent(scope);
      if (!channel || needsBuilding || !buildingsReady) throw new Error(`Choose an available building before connecting ${option.label}.`);
      const latest = await messagingAgentApi.status();
      requireCurrent(scope);
      const available = connectionChannel(latest, userId, projectId, option.id);
      if (!available) throw new Error(`${option.label} is unavailable for your current project access.`);
      const link = await messagingAgentApi.link(available, projectId, selectedBuilding?.id ?? null);
      requireCurrent(scope);
      window.location.assign(channelConnectUrl(link, option));
    },
  });

  return { visible: Boolean(channel), connected, switching: !connected && Boolean(channel && status.data?.connections.some((connection) => connection.channel === channel.id && connection.accountId === channel.accountId)), buildings: realBuildings, buildingId: selectedBuilding?.id,
    needsBuilding, ready: Boolean(channel) && buildingsReady && !needsBuilding, connect };
}
