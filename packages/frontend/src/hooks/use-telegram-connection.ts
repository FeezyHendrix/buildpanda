import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagingAgentApi } from "@/api/messaging-agent";
import { useSession } from "@/stores/auth";
import { useActiveOrganizationId } from "@/hooks/use-organization";
import { useBuildings } from "@/hooks/use-buildings";
import { participantKeys, useProjectAccess } from "@/hooks/use-participants";
import { canConnectTelegram, telegramChannel, telegramConnectUrl } from "@/lib/telegram-connection";

export const telegramKeys = {
  status: (userId: string, organizationId: string | null, projectId: string, permissions: unknown) =>
    ["projects", projectId, "telegram", userId, organizationId, permissions] as const,
};

export function useTelegramConnection(projectId: string, buildingId: string | undefined) {
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
  const permitted = online && !session.isPending && Boolean(userId) && !access.isError && !access.isStale && canConnectTelegram(access.data);
  const current = useRef({ projectId, buildingId, userId, organizationId, permitted });
  current.current = { projectId, buildingId, userId, organizationId, permitted };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function requireCurrent(scope: typeof current.current) {
    const active = current.current;
    const state = client.getQueryState(participantKeys.access(projectId));
    if (!mounted.current || !navigator.onLine || !active.permitted || active.projectId !== scope.projectId || active.buildingId !== scope.buildingId || active.userId !== scope.userId ||
      active.organizationId !== scope.organizationId || state?.isInvalidated || state?.error || state?.data !== access.data || !canConnectTelegram(access.data)) {
      throw new Error("Project access changed. Reopen this project before connecting Telegram.");
    }
  }
  const status = useQuery({
    queryKey: telegramKeys.status(userId, organizationId, projectId, access.data?.permissions),
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
  const channel = permitted && !status.isError ? telegramChannel(status.data, userId, projectId) : undefined;
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
    mutationFn: async () => {
      const scope = current.current;
      requireCurrent(scope);
      if (!channel || needsBuilding || !buildingsReady) throw new Error("Choose an available building before connecting Telegram.");
      const latest = await messagingAgentApi.status();
      requireCurrent(scope);
      const available = telegramChannel(latest, userId, projectId);
      if (!available) throw new Error("Telegram is unavailable for your current project access.");
      const link = await messagingAgentApi.link(available, projectId, selectedBuilding?.id ?? null);
      requireCurrent(scope);
      window.location.assign(telegramConnectUrl(link));
    },
  });

  return { visible: Boolean(channel), connected, switching: !connected && Boolean(channel && status.data?.connections.some((connection) => connection.channel === channel.id && connection.accountId === channel.accountId)), buildings: realBuildings, buildingId: selectedBuilding?.id,
    needsBuilding, ready: Boolean(channel) && buildingsReady && !needsBuilding, connect };
}
