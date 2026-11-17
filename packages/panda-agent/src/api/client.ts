export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include",
    signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: { ...(options.body !== undefined && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body: unknown = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : `The request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

export async function requestFile(path: string): Promise<{ blob: Blob; fileName?: string }> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Choose a BuildPanda document revision.");
  const response = await fetch(`${baseUrl}${path}`, { credentials: "include", signal: AbortSignal.timeout(180_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `The document is unavailable (${response.status}).`);
  }
  const encoded = /filename="([^\"]+)"/i.exec(response.headers.get("content-disposition") ?? "")?.[1];
  let fileName = encoded;
  try { if (encoded) fileName = decodeURIComponent(encoded); } catch { /* Keep an unencoded filename. */ }
  return { blob: await response.blob(), fileName };
}
