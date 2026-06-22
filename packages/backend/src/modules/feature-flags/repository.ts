import type { Knex } from "knex";
import type { FeatureFlagMap } from "./types.ts";

const SINGLETON_ID = "singleton";

export interface FeatureFlagSettingsRow {
  id: string;
  feature_flags: FeatureFlagMap | string;
  updated_by_id: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

export interface UpdateFeatureFlagsInput {
  flags: FeatureFlagMap;
  updatedById: string;
  updatedByName: string;
}

export function featureFlagsRepository(db: Knex) {
  return {
    get(): Promise<FeatureFlagSettingsRow | undefined> {
      return db<FeatureFlagSettingsRow>("platform_settings").where({ id: SINGLETON_ID }).first();
    },

    async update(input: UpdateFeatureFlagsInput): Promise<FeatureFlagSettingsRow> {
      const [row] = await db<FeatureFlagSettingsRow>("platform_settings")
        .insert({
          id: SINGLETON_ID,
          feature_flags: JSON.stringify(input.flags),
          updated_by_id: input.updatedById,
          updated_by_name: input.updatedByName,
          updated_at: db.fn.now() as unknown as string,
        })
        .onConflict("id")
        .merge()
        .returning("*");
      if (!row) throw new Error("Failed to persist feature flags");
      return row;
    },
  };
}

export type FeatureFlagsRepository = ReturnType<typeof featureFlagsRepository>;
