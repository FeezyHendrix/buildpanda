import { useQuery } from "@tanstack/react-query";
import { maintenanceApi } from "@/api/maintenance";
import type { MaintenanceStatus } from "@/api/maintenance";

export type { MaintenanceStatus };

const FALLBACK: MaintenanceStatus = { enabled: false, message: null, allowed: true };

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ["maintenance-status"],
    queryFn: () => maintenanceApi.getStatus(),
    placeholderData: FALLBACK,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
