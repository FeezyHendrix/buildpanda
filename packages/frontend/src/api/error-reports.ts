export const CLIENT_ERROR_KINDS = [
  "runtime",
  "rejection",
  "react",
  "resource",
  "http",
  "query",
  "mutation",
  "console",
] as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[number];
export const BREADCRUMB_TYPES = [
  "navigation",
  "action",
  "http",
  "lifecycle",
] as const;
export type BreadcrumbType = (typeof BREADCRUMB_TYPES)[number];
export interface ErrorBreadcrumb {
  at: string;
  type: BreadcrumbType;
  description: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
}
export interface ClientErrorContext {
  kind?: ClientErrorKind;
  componentStack?: string | null;
  request?: {
    method: string;
    path: string;
    status?: number;
    durationMs?: number;
    requestId?: string;
  };
}
export interface ClientErrorReport {
  id: string;
  sessionId: string;
  name: string;
  message: string;
  stack: string;
  kind: ClientErrorKind;
  occurredAt: string;
  occurrences: number;
  release: string;
  route: string;
  componentStack?: string;
  browser: {
    userAgent: string;
    language: string;
    viewport: string;
    online: boolean;
    visibility: string;
  };
  request?: ClientErrorContext["request"];
  breadcrumbs: ErrorBreadcrumb[];
}
export const ERROR_REPORT_PATH = "/error-reports";
const reportUrl = `${(import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "")}${ERROR_REPORT_PATH}`;

// These calls bypass the axios client so a failed delivery cannot report itself.
export const errorReportsApi = {
  /** Resolves to a retry delay in ms when the server asks the client to back off. */
  async send(body: string): Promise<number | undefined> {
    const response = await fetch(reportUrl, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    await response.body?.cancel();
    if (response.status === 429) {
      const retry = Number(response.headers.get("Retry-After"));
      return Number.isFinite(retry) && retry > 0
        ? Math.min(retry * 1000, 3_600_000)
        : 60_000;
    }
    if (response.status >= 500) return 10_000;
  },
  sendOnExit(body: string) {
    void fetch(reportUrl, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body,
    }).catch(() => undefined);
  },
};
