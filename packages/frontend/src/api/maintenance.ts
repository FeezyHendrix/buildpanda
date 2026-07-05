import api from "./client";

export interface MaintenanceStatus {
  enabled: boolean;
  message: string | null;
  allowed: boolean;
}

export const maintenanceApi = {
  getStatus: () => api.get<MaintenanceStatus>("/maintenance").then((r) => r.data),
};
