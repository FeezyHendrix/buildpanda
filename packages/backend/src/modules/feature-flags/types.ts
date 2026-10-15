export interface FeatureFlagDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
  enabledByDefault: boolean;
  routePrefixes: string[];
  /** Omitted means every method. Reads may be required even when management is disabled. */
  routeMethods?: readonly string[];
}

export interface FeatureFlag extends FeatureFlagDefinition {
  enabled: boolean;
}

export interface FeatureFlagsSettings {
  flags: FeatureFlag[];
  updatedByName: string | null;
  updatedAt: string | null;
}

export type FeatureFlagMap = Record<string, boolean>;
