export interface PlatformSettingsRow {
  id: string;
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string | null;
  updatedByName: string | null;
  updatedAt: string;
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string | null;
  allowed: boolean;
}

export interface UpdateMaintenanceInput {
  enabled?: boolean;
  message?: string | null;
  updatedById: string;
  updatedByName: string;
}
