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
    headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body: unknown = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : `The request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}
