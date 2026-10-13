import { signInPath } from "@/lib/return-path";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { ENCRYPTED_CONTENT_TYPE, isEnvelope, KEY_HEADER, fitsSealLimit, open, seal } from "@/lib/payload-crypto";
import { isStaleKeyError, payloadSession, randomBytes, resetPayloadSession } from "@/lib/payload-session";
import { toast } from "@/lib/toast";

// hostname is used to check if the app is running on staging or production
// const hostname = window.location.hostname.split(".")[0];

// const baseURL =
//   hostname === "app"
//     ? import.meta.env.VITE_API_PROD_BASE_URL
//     : import.meta.env.VITE_API_DEV_BASE_URL;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Encrypted payloads on test and app (see lib/payload-crypto). JSON bodies
// are sealed on the way out; sealed responses are opened before anything else
// reads them. Files, form data and binary bodies go as they are.
function isPlainJsonBody(data: unknown): boolean {
  if (data === undefined || data === null || typeof data !== "object") return false;
  return !(data instanceof FormData || data instanceof Blob || data instanceof ArrayBuffer || data instanceof URLSearchParams || ArrayBuffer.isView(data));
}

/** The body as the caller gave it, kept so a retry after a key change can seal it afresh. */
type PayloadConfig = InternalAxiosRequestConfig & { bpPlainData?: unknown; bpRetried?: boolean };

api.interceptors.request.use(async (config: PayloadConfig) => {
  if (!("bpPlainData" in config)) config.bpPlainData = config.data;
  const session = await payloadSession();
  if (!session) return config;
  config.headers.set(KEY_HEADER, session.publicKey);
  const json = isPlainJsonBody(config.data) ? JSON.stringify(config.data) : null;
  if (json !== null && fitsSealLimit(json)) {
    config.data = JSON.stringify(seal(session, json, randomBytes));
    config.headers.set("Content-Type", ENCRYPTED_CONTENT_TYPE);
  }
  return config;
});

class StaleKey extends Error {}

async function openResponse(response: AxiosResponse | undefined): Promise<void> {
  if (!response || !isEnvelope(response.data)) return;
  const session = await payloadSession();
  if (!session) throw new StaleKey();
  try {
    response.data = JSON.parse(open(session, response.data));
  } catch {
    // Sealed with a key this tab does not hold.
    throw new StaleKey();
  }
}

/**
 * The key changed while this tab was open (rotated, or encryption switched
 * on or off): fetch it again and send the request once more, from the body
 * the caller gave rather than the copy sealed with the old key.
 */
function retryWithFreshKey(config: PayloadConfig | undefined) {
  if (!config || config.bpRetried) return null;
  resetPayloadSession();
  config.bpRetried = true;
  config.data = config.bpPlainData;
  // Headers from the sealed attempt no longer describe this one: the
  // interceptor re-adds the key if there still is one, and the length of
  // the sealed body would leave the server waiting for bytes never sent.
  config.headers.delete(KEY_HEADER);
  config.headers.delete("Content-Length");
  // Only a JSON body was sealed; form data keeps the type axios gives it.
  if (isPlainJsonBody(config.data)) config.headers.set("Content-Type", "application/json");
  return api(config);
}

api.interceptors.response.use(
  async (response) => {
    try {
      await openResponse(response);
    } catch (error) {
      const retry = error instanceof StaleKey ? retryWithFreshKey(response.config) : null;
      if (retry) return retry;
      throw error;
    }
    return response;
  },
  async (error) => {
    let stale = false;
    try {
      await openResponse(error.response);
    } catch (openError) {
      stale = openError instanceof StaleKey;
    }
    if (stale || isStaleKeyError(error.response?.status, error.response?.data)) {
      const retry = retryWithFreshKey(error.config);
      if (retry) return retry;
    }
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = signInPath(window.location.pathname + window.location.search + window.location.hash);
    } else if (error.response?.status === 403) {
      // Toast a forbidden action, but let forbidden reads fail quietly. A page
      // that fires several GETs a user cannot see would otherwise stack one
      // toast per denied query on load — the UI already shows its empty state,
      // so the pile of notifications was pure noise.
      const method = error.config?.method?.toUpperCase();
      if (method && method !== "GET") {
        const message =
          (error.response.data as { error?: string } | undefined)?.error ??
          "You do not have permission to perform this action.";
        toast(message, "error");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
