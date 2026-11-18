import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { payloadFetch } from "./payload-fetch";
import { API_BASE_URL } from "./api-base-url";
export { API_BASE_URL } from "./api-base-url";
export const authClient = createAuthClient({ baseURL: API_BASE_URL, fetchOptions: { timeout: 15000, customFetchImpl: payloadFetch, credentials: "include" }, plugins: [organizationClient()] });
export const { useSession, signIn, signOut } = authClient;
