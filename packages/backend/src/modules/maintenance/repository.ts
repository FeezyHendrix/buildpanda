import type { Knex } from "knex";
import type { PlatformSettingsRow, UpdateMaintenanceInput } from "./types.ts";

const SINGLETON_ID = "singleton";

export function maintenanceRepository(db: Knex) {
  return {
    async get(): Promise<PlatformSettingsRow | undefined> {
      return db<PlatformSettingsRow>("platform_settings").where({ id: SINGLETON_ID }).first();
    },

    async update(input: UpdateMaintenanceInput): Promise<PlatformSettingsRow> {
      const patch: Partial<PlatformSettingsRow> = {
        updated_by_id: input.updatedById,
        updated_by_name: input.updatedByName,
        updated_at: db.fn.now() as unknown as string,
      };
      if (input.enabled !== undefined) patch.maintenance_enabled = input.enabled;
      if (input.message !== undefined) patch.maintenance_message = input.message;

      const [row] = await db<PlatformSettingsRow>("platform_settings")
        .insert({ id: SINGLETON_ID, ...patch })
        .onConflict("id")
        .merge()
        .returning("*");
      if (!row) throw new Error("Failed to persist platform settings");
      return row;
    },
  };
}

export type MaintenanceRepository = ReturnType<typeof maintenanceRepository>;
