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
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
