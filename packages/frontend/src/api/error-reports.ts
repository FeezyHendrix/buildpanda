export type ClientErrorKind =
  | "runtime"
  | "rejection"
  | "react"
  | "resource"
  | "http"
  | "query"
  | "mutation"
  | "console";
export interface ErrorBreadcrumb {
  at: string;
  type: "navigation" | "action" | "http" | "lifecycle";
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
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
export const ERROR_REPORT_PATH = "/error-reports";

// This request bypasses the normal API interceptors so delivery failures cannot report themselves.
export function serializeErrorReport(report: ClientErrorReport): string {
  const bounded = { ...report, breadcrumbs: [...report.breadcrumbs] };
  let body = JSON.stringify(bounded);
  for (
    let pass = 0;
    pass < 40 && new TextEncoder().encode(body).length > 45_000;
    pass += 1
  ) {
    if (bounded.stack.length > 2000)
      bounded.stack = bounded.stack.slice(
        0,
        Math.floor(bounded.stack.length / 2),
      );
    else if ((bounded.componentStack?.length ?? 0) > 1000)
      bounded.componentStack = bounded.componentStack!.slice(0, 1000);
    else if (bounded.breadcrumbs.length) bounded.breadcrumbs.shift();
    else bounded.message = bounded.message.slice(0, 500);
    body = JSON.stringify(bounded);
  }
  return body;
}
export async function sendErrorReport(
  report: ClientErrorReport,
): Promise<number | undefined> {
  const response = await fetch(`${baseUrl}${ERROR_REPORT_PATH}`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: serializeErrorReport(report),
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
}

export function sendErrorReportsOnExit(reports: ClientErrorReport[]) {
  const selected = reports
    .slice(0, 20)
    .map(
      (report) => JSON.parse(serializeErrorReport(report)) as ClientErrorReport,
    );
  if (!selected.length) return;
  let body = JSON.stringify({ reports: selected });
  while (
    new TextEncoder().encode(body).length > 45_000 &&
    selected.some(
      (report) =>
        report.stack ||
        report.componentStack ||
        report.breadcrumbs.length ||
        report.message.length > 300,
    )
  ) {
    for (const report of selected) {
      report.stack = report.stack.slice(0, Math.floor(report.stack.length / 2));
      report.componentStack = report.componentStack?.slice(
        0,
        Math.floor(report.componentStack.length / 2),
      );
      report.breadcrumbs = report.breadcrumbs.slice(
        Math.ceil(report.breadcrumbs.length / 2),
      );
      report.message = report.message.slice(
        0,
        Math.max(300, Math.floor(report.message.length / 2)),
      );
    }
    body = JSON.stringify({ reports: selected });
  }
  while (
    new TextEncoder().encode(body).length > 45_000 &&
    selected.length > 1
  ) {
    selected.pop();
    body = JSON.stringify({ reports: selected });
  }
  void fetch(`${baseUrl}${ERROR_REPORT_PATH}`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => undefined);
}
