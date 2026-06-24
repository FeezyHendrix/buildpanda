import type { MaintenanceRepository } from "./repository.ts";
import type {
  MaintenanceSettings,
  MaintenanceStatus,
  PlatformSettingsRow,
  UpdateMaintenanceInput,
} from "./types.ts";

function toSettings(row: PlatformSettingsRow): MaintenanceSettings {
  return {
    enabled: row.maintenance_enabled,
    message: row.maintenance_message,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
  };
}

const DEFAULT_SETTINGS: MaintenanceSettings = {
  enabled: false,
  message: null,
  updatedByName: null,
  updatedAt: new Date(0).toISOString(),
};

export function maintenanceService(repo: MaintenanceRepository) {
  return {
    async getSettings(): Promise<MaintenanceSettings> {
      const row = await repo.get();
      return row ? toSettings(row) : DEFAULT_SETTINGS;
    },

    async getStatus(isAdmin: boolean): Promise<MaintenanceStatus> {
      const row = await repo.get();
      const enabled = row?.maintenance_enabled ?? false;
      return {
        enabled,
        message: row?.maintenance_message ?? null,
        allowed: !enabled || isAdmin,
      };
    },

    async update(input: UpdateMaintenanceInput): Promise<MaintenanceSettings> {
      const row = await repo.update(input);
      return toSettings(row);
    },
  };
}

export type MaintenanceServiceInstance = ReturnType<typeof maintenanceService>;
