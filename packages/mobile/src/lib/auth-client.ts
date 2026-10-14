import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { payloadFetch } from "./payload-fetch";
import { storage } from "./storage";

/**
 * Same backend, same `/api/auth/*` routes as the web app. The Expo plugin
 * emulates the browser's cookie jar in the device keychain, so no bearer-token
 * scheme and no server-side auth fork is needed.
 *
 * `baseURL` is the bare origin — better-auth appends its own `/api/auth`
 * basePath, matching how the web client is configured.
 */
// Kept in its own module so the payload session can read it without
// importing the auth client that uses it.
export { API_BASE_URL } from "./api-base-url";
import { API_BASE_URL } from "./api-base-url";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  // Auth replies (sessions, members, invitations) are encrypted like the
  // rest of the API on test and app.
  fetchOptions: { timeout: 15_000, customFetchImpl: payloadFetch },
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
