// EXPO_PUBLIC_API_URL is inlined at bundle time. Falling back to localhost in a
// release bundle ships an app that can reach no backend at all, so the default
// is confined to dev and a release build without it fails loudly instead.
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");
  if (__DEV__) return "http://localhost:3000";
  throw new Error(
    "EXPO_PUBLIC_API_URL was not set when this build was bundled — it has no backend to talk to.",
  );
}

export const API_BASE_URL = resolveApiBaseUrl();
