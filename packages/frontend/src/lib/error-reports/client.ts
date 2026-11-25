import {
  sendErrorReport,
  sendErrorReportsOnExit,
  type ClientErrorContext,
  type ClientErrorReport,
  type ErrorBreadcrumb,
} from "@/api/error-reports";
import { asError, safePath, safeText } from "./redact";

const enabled =
  import.meta.env.VITE_ERROR_SINK_ENABLED === "true" ||
  (import.meta.env.PROD && import.meta.env.VITE_ERROR_SINK_ENABLED !== "false");
const sessionId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const breadcrumbs: ErrorBreadcrumb[] = [];
const seen = new WeakMap<object, number>();
const groups = new Map<
  string,
  { report: ClientErrorReport; repeats: number }
>();
// shortcut: the browser buffer is in memory; persist sanitized reports if offline diagnostics must survive reloads.
const pending: ClientErrorReport[] = [];
let sending = false,
  retryAt = 0,
  overflow = 0;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function addErrorBreadcrumb(crumb: Omit<ErrorBreadcrumb, "at">) {
  if (!enabled) return;
  breadcrumbs.push({
    ...crumb,
    at: new Date().toISOString(),
    description: safeText(crumb.description, 300),
  });
  if (breadcrumbs.length > 30) breadcrumbs.shift();
}
async function drain() {
  if (sending || !navigator.onLine) return;
  sending = true;
  try {
    while (pending.length && navigator.onLine) {
      if (retryAt > Date.now()) await delay(retryAt - Date.now());
      const report = pending[0];
      if (!report) break;
      try {
        const retry = await sendErrorReport(report);
        if (retry) {
          retryAt = Date.now() + retry;
          break;
        }
        pending.shift();
        retryAt = Date.now() + 2100;
      } catch {
        retryAt = Date.now() + 10_000;
        break;
      }
    }
  } finally {
    sending = false;
    if (pending.length && navigator.onLine)
      setTimeout(
        () => {
          void drain();
        },
        Math.max(1000, retryAt - Date.now()),
      );
  }
}
function enqueue(report: ClientErrorReport) {
  if (pending.length >= 50) {
    overflow += report.occurrences;
    return;
  }
  if (overflow) {
    report.breadcrumbs = [
      ...report.breadcrumbs.slice(-29),
      {
        at: new Date().toISOString(),
        type: "lifecycle",
        description: `${overflow} additional errors exceeded the local reporting buffer while delivery was unavailable.`,
      },
    ];
    overflow = 0;
  }
  pending.push(report);
  void drain();
}
export function reportFrontendError(
  value: unknown,
  context: ClientErrorContext = {},
) {
  if (!enabled) return;
  try {
    if (value && typeof value === "object") {
      if (seen.has(value) && Date.now() - seen.get(value)! < 1000) return;
      seen.set(value, Date.now());
    }
    const error = asError(value),
      now = new Date().toISOString();
    const report: ClientErrorReport = {
      id:
        crypto.randomUUID?.() ??
        `error_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sessionId,
      name: safeText(error.name, 100),
      message: safeText(error.message),
      stack: safeText(error.stack ?? "", 12000),
      kind: context.kind ?? "runtime",
      occurredAt: now,
      occurrences: 1,
      release: safeText(import.meta.env.VITE_APP_RELEASE || "unknown", 120),
      route: safePath(window.location.href),
      componentStack: context.componentStack
        ? safeText(context.componentStack, 6000)
        : undefined,
      browser: {
        userAgent: safeText(navigator.userAgent, 350),
        language: navigator.language.slice(0, 30),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        online: navigator.onLine,
        visibility: document.visibilityState,
      },
      request: context.request
        ? { ...context.request, path: safePath(context.request.path) }
        : undefined,
      breadcrumbs: [...breadcrumbs],
    };
    const fingerprint = JSON.stringify([
      report.kind,
      report.name,
      report.message,
      report.route,
      report.stack.split("\n").slice(1, 3),
    ]);
    const group = groups.get(fingerprint);
    if (group) {
      group.repeats += 1;
      group.report = report;
      return;
    }
    if (groups.size >= 500) {
      enqueue(report);
      return;
    }
    groups.set(fingerprint, { report, repeats: 0 });
    enqueue(report);
    setTimeout(() => {
      const current = groups.get(fingerprint);
      groups.delete(fingerprint);
      if (current?.repeats)
        enqueue({ ...current.report, occurrences: current.repeats });
    }, 60_000);
  } catch {
    /* An error reporter must never interrupt the application. */
  }
}
export function resumeErrorReports() {
  void drain();
}

export function flushFrontendReports() {
  if (!enabled) return;
  const reports = [...pending];
  for (const group of groups.values())
    if (group.repeats) {
      reports.push({ ...group.report, occurrences: group.repeats });
      group.repeats = 0;
    }
  // Best effort on mobile backgrounding; the browser can terminate this page without a final callback.
  sendErrorReportsOnExit(reports);
}
