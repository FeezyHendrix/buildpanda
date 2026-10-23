import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json stays the static base; only the parts that must vary per build live
// here. The update URL is native config baked in by `expo prebuild`, so unlike
// EXPO_PUBLIC_API_URL it cannot be swapped at bundle time — it has to be
// resolved when the config is evaluated.
const DEFAULT_API_URL = "https://api.staging.buildpanda.io";

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");

  return {
    ...config,
    name: config.name ?? "BuildPanda Field",
    slug: config.slug ?? "buildpanda-field-tool",
    // An update is only launched when its runtimeVersion matches the build's,
    // so this must change whenever native code does — bumping `version` in
    // app.json is what marks a build as incompatible with older JS.
    runtimeVersion: { policy: "appVersion" },
    plugins: [
      ...(config.plugins ?? []),
      // Writes the native sentry.properties that lets a release build upload
      // its source maps and dSYMs. The project slug and auth token come from
      // SENTRY_PROJECT / SENTRY_AUTH_TOKEN in the build environment, so no
      // credential is committed here.
      [
        "@sentry/react-native",
        {
          organization: process.env.SENTRY_ORG ?? "buildpanda",
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    updates: {
      url: `${apiUrl}/ota/manifest`,
      enabled: true,
      checkAutomatically: "ON_LOAD",
      // Never block launch on the network: crews start the app on sites with no
      // signal. The cached bundle launches immediately and a new one is fetched
      // in the background for the next cold start.
      fallbackToCacheTimeout: 0,
    },
  };
};
