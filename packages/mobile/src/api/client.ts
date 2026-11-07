import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

/**
 * The only place URLs are joined and auth is attached. Feature services wrap
 * this; screens and hooks never call it directly.
 *
 * Native has no cookie jar, so the keychain-stored cookie is set by hand. On
 * web the browser owns cookies and a manual `cookie` header is ignored — it
 * needs `credentials` instead, or every call comes back 401.
 */
interface ErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
}

// A schema rejection arrives as `{ error: "Invalid request", details: [...] }`.
// Showing only the headline hides the one thing the crew needs — which field —
// so the validation messages are folded into the text the app displays.
function describeError(body: ErrorBody | null, status: number): string {
  const headline = body?.error ?? `Request failed (${status})`;
  if (!Array.isArray(body?.details)) return headline;
  const reasons = body.details
    .map((detail) => {
      const entry = detail as { instancePath?: string; message?: string } | null;
      if (!entry?.message) return null;
      const field = entry.instancePath?.replace(/^\//, "").replace(/\//g, ".");
      return field ? `${field} ${entry.message}` : entry.message;
    })
    .filter((reason): reason is string => reason !== null);
  return reasons.length > 0 ? `${headline}: ${reasons.join("; ")}` : headline;
}

export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...init?.headers,
  };
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

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
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ErrorBody | null;
      throw new ApiError(response.status, describeError(body, response.status));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (timedOut) throw new ApiError(0, "The connection timed out. Your saved changes are still on this device.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
