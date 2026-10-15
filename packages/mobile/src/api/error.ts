export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Unknown 403s still fail closed; only the server's explicit feature code is exempt. */
export function isAccessRejection(error: { status: number; code?: string }): boolean {
  return error.status === 401 || (error.status === 403 && error.code !== "feature_disabled");
}

/** JSON, multipart and streamed requests share the same error contract. */
export function responseError(status: number, body: unknown, fallback = `Request failed (${status})`): ApiError {
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const headline = typeof value.error === "string" ? value.error : fallback;
  const code = typeof value.code === "string" ? value.code : undefined;
  const reasons = Array.isArray(value.details) ? value.details.flatMap((detail: unknown) => {
    if (!detail || typeof detail !== "object") return [];
    const entry = detail as { instancePath?: unknown; message?: unknown };
    if (typeof entry.message !== "string") return [];
    const field = typeof entry.instancePath === "string" ? entry.instancePath.replace(/^\//, "").replace(/\//g, ".") : "";
    return [field ? `${field} ${entry.message}` : entry.message];
  }) : [];
  return new ApiError(status, reasons.length ? `${headline}: ${reasons.join("; ")}` : headline, code);
}
