import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export interface MaintenanceStatus {
  enabled: boolean;
  message: string | null;
  allowed: boolean;
}

const FALLBACK: MaintenanceStatus = { enabled: false, message: null, allowed: true };

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ["maintenance-status"],
    queryFn: async (): Promise<MaintenanceStatus> => {
      const res = await api.get<MaintenanceStatus>("/maintenance");
      return res.data;
    },
    placeholderData: FALLBACK,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
