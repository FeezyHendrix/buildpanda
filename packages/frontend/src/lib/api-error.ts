import { isAxiosError } from "axios";

interface ValidationDetail {
  instancePath?: string;
  params?: { missingProperty?: string };
  message?: string;
}

interface ApiErrorBody {
  error?: string;
  code?: string;
  details?: unknown;
  /** Some legacy handlers answer with `{ message }` instead of `{ error }`. */
  message?: string;
}

const FALLBACK = "Something went wrong. Please try again.";

function body(err: unknown): ApiErrorBody | undefined {
  return isAxiosError(err) ? (err.response?.data as ApiErrorBody | undefined) : undefined;
}

function validationDetails(err: unknown): ValidationDetail[] {
  const details = body(err)?.details;
  return Array.isArray(details) ? (details as ValidationDetail[]) : [];
}

/** "/location" -> "Location", "/lines/0/quantity" -> "Quantity". */
function humanizeField(path: string): string {
  const leaf = path.split("/").filter((part) => part.length > 0 && !/^\d+$/.test(part)).pop();
  if (!leaf) return "";
  const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The field a 400 validation failure names, as a path such as `/location`, or
 * `null` when the server did not blame one field. Forms use it to put the error
 * next to the input instead of only at the foot of the drawer.
 */
export function errorField(err: unknown): string | null {
  for (const detail of validationDetails(err)) {
    if (detail.instancePath) return detail.instancePath;
    if (detail.params?.missingProperty) return `/${detail.params.missingProperty}`;
  }
  return null;
}

/** The bare field name a 400 names ("location"), for matching a form input. */
export function errorFieldName(err: unknown): string | null {
  const path = errorField(err);
  if (!path) return null;
  const parts = path.split("/").filter((part) => part.length > 0 && !/^\d+$/.test(part));
  return parts.length > 0 ? parts[parts.length - 1]! : null;
}

/**
 * The message to show the user for a failed request.
 *
 * The backend serializes failures as `{ error, code, details? }` (see
 * backend/src/plugins/error-handler.ts), so the server's own wording always
 * wins over axios's useless "Request failed with status code 409". A schema
 * rejection is rewritten to name the field ("Location must NOT have fewer than
 * 1 characters") rather than the opaque "Invalid request".
 */
export function errorMessage(err: unknown, fallback = FALLBACK): string {
  if (err === null || err === undefined) return fallback;

  const data = body(err);
  const detail = validationDetails(err)[0];
  if (detail?.message) {
    const field = humanizeField(detail.instancePath ?? `/${detail.params?.missingProperty ?? ""}`);
    return field ? `${field} ${detail.message}` : detail.message;
  }
  if (data?.error) return data.error;
  if (data?.message) return data.message;

  if (isAxiosError(err)) {
    if (err.code === "ERR_NETWORK") return "Could not reach the server. Check your connection and try again.";
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  return fallback;
}

/**
 * Kept for the many call sites that already import it; `errorMessage` is the
 * one helper new code should use.
 */
export function getApiErrorMessage(err: unknown, fallback = FALLBACK): string {
  return errorMessage(err, fallback);
}

/** HTTP status code for an axios error, if available. */
export function getApiErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}

/** The backend's machine-readable `code`, e.g. "storage_unavailable". */
export function errorCode(err: unknown): string | undefined {
  return body(err)?.code;
}

/**
 * The structured `details` a typed failure carries — a 409 naming the record
 * that already exists, say. Array details belong to schema validation, so they
 * are excluded here.
 */
export function errorDetails<T extends object = Record<string, unknown>>(
  err: unknown,
): T | null {
  const details = body(err)?.details;
  if (details === null || typeof details !== "object" || Array.isArray(details)) return null;
  return details as T;
}

/** True when the failure is the file store being down (typed 503 from /files). */
export function isStorageUnavailable(err: unknown): boolean {
  return getApiErrorStatus(err) === 503 && errorCode(err) === "storage_unavailable";
}
