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
export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...init?.headers,
  };
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `Request failed (${response.status})`);
  }

  return (await response.json()) as T;
}
