import type { Knex } from "knex";
import type { NewOtaUpdateRecord, OtaPlatform, OtaUpdateRow } from "./types.ts";

export function otaRepository(db: Knex) {
  return {
    async insert(record: NewOtaUpdateRecord): Promise<OtaUpdateRow> {
      const [row] = await db<OtaUpdateRow>("ota_updates").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert OTA update");
      return row;
    },

    latestFor(platform: OtaPlatform, runtimeVersion: string): Promise<OtaUpdateRow | undefined> {
      return db<OtaUpdateRow>("ota_updates")
        .where({ platform, runtime_version: runtimeVersion })
        .orderBy("created_at", "desc")
        .first();
    },

    byId(id: string): Promise<OtaUpdateRow | undefined> {
      return db<OtaUpdateRow>("ota_updates").where({ id }).first();
    },
  };
}

export type OtaRepository = ReturnType<typeof otaRepository>;
