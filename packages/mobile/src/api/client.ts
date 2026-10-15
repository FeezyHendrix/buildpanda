import { messagingAccess } from "@/lib/feature-access";
import { projectAccess } from "@/lib/project-access-store";
import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";
import { ENCRYPTED_CONTENT_TYPE, isEnvelope, KEY_HEADER, fitsSealLimit, open, seal, type PayloadSession } from "@/lib/payload-crypto";
import { isStaleKeyError, payloadSession, randomBytes, resetPayloadSession } from "@/lib/payload-session";
import { apiRequirement } from "@/lib/api-access";
import { requireAccess, requireCurrentAccess, revokeProjectAccess } from "@/lib/project-access-store";
import { ApiError, isAccessRejection, responseError } from "./error";
export { ApiError } from "./error";

type RequestOptions = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

/**
 * The only place URLs are joined and auth is attached. Feature services wrap
 * this; screens and hooks never call it directly.
 *
 * Native has no cookie jar, so the keychain-stored cookie is set by hand. On
 * web the browser owns cookies and a manual `cookie` header is ignored — it
 * needs `credentials` instead, or every call comes back 401.
 */
/** A reply sealed with a key this app session does not hold. */
class StaleKey extends Error {}

/** Reads a JSON body, opening it first when the server sealed it (test and app). */
async function readJson(response: Response, session: PayloadSession | null): Promise<unknown> {
  const body: unknown = await response.json();
  if (!isEnvelope(body)) return body;
  if (!session) throw new StaleKey();
  try {
    return JSON.parse(open(session, body));
  } catch {
    throw new StaleKey();
  }
}

/**
 * One request, retried once with a fresh key when the server's changed while
 * the app was open (rotated, or encryption switched on or off). Without the
 * retry that answer is a 400, which the outbox would treat as permanent and
 * fail a write that was never wrong.
 */
export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  try {
    return await attempt<T>(path, init);
  } catch (error) {
    if (!(error instanceof StaleKey)) throw error;
    resetPayloadSession();
    return attempt<T>(path, init);
  }
}

async function attempt<T>(path: string, init?: RequestOptions): Promise<T> {
  const messaging = /^\/(channels|messages)(?:\/|$)/.test(path);
  const projectId = /^\/projects\/([^/?]+)/.exec(path)?.[1] ?? (messaging ? projectAccess.getState().scope?.projectId : undefined);
  const permission = messaging ? messagingAccess : projectId ? apiRequirement(path, init?.method, typeof init?.body === "string" ? JSON.parse(init.body) : {}) : null;
  const ticket = permission ? requireAccess(projectId!, permission) : null;
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...init?.headers,
  };
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  // Encrypted payloads where the server has them on; JSON bodies only.
  const session = await payloadSession();
  let body = init?.body;
  if (typeof body === "string" && body.includes("local_image_")) {
    if (!projectId || !ticket) throw new ApiError(403, "Select an authorized project before adding images.");
    const { prepareContentImages } = await import("@/lib/content-images");
    body = JSON.stringify(await prepareContentImages(projectId, JSON.parse(body)));
    requireCurrentAccess(ticket);
  }
  if (session) {
    headers[KEY_HEADER] = session.publicKey;
    if (typeof body === "string" && fitsSealLimit(body)) {
      body = JSON.stringify(seal(session, body, randomBytes));
      headers["Content-Type"] = ENCRYPTED_CONTENT_TYPE;
    }
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  const signal = init?.signal;
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30_000);

  try {
    if (ticket) requireCurrentAccess(ticket);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      body,
      signal: controller.signal,
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const failure = await readJson(response, session).catch((error: unknown) => {
        if (error instanceof StaleKey) {
          if (ticket && isAccessRejection(response)) { requireCurrentAccess(ticket); revokeProjectAccess(); }
          throw error;
        }
        return null;
      });
      const error = responseError(response.status, failure);
      if (ticket) { requireCurrentAccess(ticket); if (isAccessRejection(error)) revokeProjectAccess(); }
      if (isStaleKeyError(response.status, failure)) throw new StaleKey();
      throw error;
    }
    if (response.status === 204) { if (ticket) requireCurrentAccess(ticket); return undefined as T; }
    const data = (await readJson(response, session)) as T;
    if (ticket) requireCurrentAccess(ticket);
    return data;
  } catch (error) {
    if (timedOut) throw new ApiError(0, "The connection timed out. Your saved changes are still on this device.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
