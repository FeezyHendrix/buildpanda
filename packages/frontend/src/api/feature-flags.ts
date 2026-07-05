import api from "./client";

export interface FeatureFlag {
  key: string;
  label: string;
  group: string;
  description: string;
  enabledByDefault: boolean;
  routePrefixes: string[];
  enabled: boolean;
}

export interface FeatureFlagsSettings {
  flags: FeatureFlag[];
}

export const featureFlagsApi = {
  get: () => api.get<FeatureFlagsSettings>("/feature-flags").then((r) => r.data),
};
