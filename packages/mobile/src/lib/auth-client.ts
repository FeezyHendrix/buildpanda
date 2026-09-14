import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { storage } from "./storage";

/**
 * Same backend, same `/api/auth/*` routes as the web app. The Expo plugin
 * emulates the browser's cookie jar in the device keychain, so no bearer-token
 * scheme and no server-side auth fork is needed.
 *
 * `baseURL` is the bare origin — better-auth appends its own `/api/auth`
 * basePath, matching how the web client is configured.
 */
// EXPO_PUBLIC_API_URL is inlined at bundle time. Falling back to localhost in a
// release bundle ships an app that can reach no backend at all, so the default
// is confined to dev and a release build without it fails loudly instead.
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  if (__DEV__) return "http://localhost:3000";
  throw new Error(
    "EXPO_PUBLIC_API_URL was not set when this build was bundled — it has no backend to talk to.",
  );
}

export const API_BASE_URL = resolveApiBaseUrl();

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    expoClient({
      scheme: "buildpanda",
      storagePrefix: "buildpanda",
      storage,
    }),
    organizationClient(),
  ],
});

export const { useSession, signIn, signOut } = authClient;
