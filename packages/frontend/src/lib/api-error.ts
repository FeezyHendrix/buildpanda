import { isAxiosError } from "axios";

interface ApiErrorBody {
  error?: string;
  code?: string;
}

/**
 * Extract the server-provided error message from an axios/unknown error.
 * The backend serializes failures as `{ error: string }` (see
 * backend/src/plugins/error-handler.ts), so prefer that over axios's generic
 * "Request failed with status code …" message.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error) return body.error;
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** HTTP status code for an axios error, if available. */
export function getApiErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}
