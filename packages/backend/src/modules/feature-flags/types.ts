export interface FeatureFlagDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
  enabledByDefault: boolean;
  routePrefixes: string[];
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
