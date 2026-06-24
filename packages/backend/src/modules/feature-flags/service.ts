import { FEATURE_FLAGS } from "./definitions.ts";
import type { FeatureFlagsRepository } from "./repository.ts";
import type { FeatureFlag, FeatureFlagMap, FeatureFlagsSettings } from "./types.ts";

function parseMap(value: FeatureFlagMap | string | null | undefined): FeatureFlagMap {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as FeatureFlagMap;
    } catch {
      return {};
    }
  }
  return value;
}

function mergeFlags(raw: FeatureFlagMap): FeatureFlag[] {
  return FEATURE_FLAGS.map((definition) => ({
    ...definition,
    enabled: raw[definition.key] ?? definition.enabledByDefault,
  }));
}

export function featureFlagsService(repo: FeatureFlagsRepository) {
  return {
    async getSettings(): Promise<FeatureFlagsSettings> {
      const row = await repo.get();
      return {
        flags: mergeFlags(parseMap(row?.feature_flags)),
        updatedByName: row?.updated_by_name ?? null,
        updatedAt: row?.updated_at ?? null,
      };
    },

    async update(flags: FeatureFlagMap, admin: { id: string; name: string }): Promise<FeatureFlagsSettings> {
      const allowed = new Set<string>(FEATURE_FLAGS.map((f) => f.key));
      const clean: FeatureFlagMap = {};
      for (const [key, value] of Object.entries(flags)) {
        if (allowed.has(key)) clean[key] = Boolean(value);
      }
      const row = await repo.update({ flags: clean, updatedById: admin.id, updatedByName: admin.name });
      return {
        flags: mergeFlags(parseMap(row.feature_flags)),
        updatedByName: row.updated_by_name,
        updatedAt: row.updated_at,
      };
    },

    async isEnabled(key: string): Promise<boolean> {
      const row = await repo.get();
      const raw = parseMap(row?.feature_flags);
      const definition = FEATURE_FLAGS.find((flag) => flag.key === key);
      return raw[key] ?? definition?.enabledByDefault ?? true;
    },
  };
}

export type FeatureFlagsServiceInstance = ReturnType<typeof featureFlagsService>;
