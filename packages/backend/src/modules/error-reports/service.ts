import { createHash, randomUUID } from "node:crypto";
import { errorDetails, redactText, safePath, safeTags } from "./redact.ts";
import type {
  ClientEvent,
  ErrorActor,
  ErrorContext,
  ErrorReport,
  ErrorSinkOptions,
  FrontendErrorBody,
  FrontendErrorInput,
  ReportGroup,
} from "./types.ts";

export function errorReportService(options: ErrorSinkOptions) {
  const now = options.now ?? Date.now;
  const schedule =
    options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
  const seen = new WeakMap<object, number>();
  // shortcut: grouping and ingest deduplication are per process; use Redis counters for deployment-wide counts.
  const groups = new Map<string, ReportGroup>();
  const clientEvents = new Map<string, ClientEvent>();
  const pending = new Set<Promise<unknown>>();
  function deliver(report: ErrorReport) {
    const task = Promise.resolve()
      .then(() => options.enqueue(report))
      .catch(() => options.onFailure("enqueue_failed"));
    pending.add(task);
    void task.finally(() => pending.delete(task));
  }
  function accept(report: ErrorReport) {
    options.record(report);
    const group = groups.get(report.fingerprint);
    if (group) {
      group.repeats += report.count;
      group.lastSeenAt = report.occurredAt;
      group.report = report;
      return report.id;
    }
    if (groups.size >= 1000) {
      deliver(report);
      return report.id;
    }
    groups.set(report.fingerprint, {
      report,
      repeats: 0,
      lastSeenAt: report.occurredAt,
    });
    deliver(report);
    schedule(() => {
      const current = groups.get(report.fingerprint);
      groups.delete(report.fingerprint);
      if (current?.repeats)
        deliver({
          ...current.report,
          count: current.repeats,
          lastSeenAt: current.lastSeenAt,
        });
    }, 60_000).unref?.();
    return report.id;
  }
  function base(
    error: unknown,
    source: ErrorReport["source"],
    context: ErrorContext,
    occurredAt?: string,
  ): ErrorReport {
    const details = errorDetails(error),
      receivedAt = new Date(now()).toISOString();
    const safeContext: ErrorContext = {
      kind: context.kind,
      requestId: context.requestId
        ? redactText(context.requestId, 120)
        : undefined,
      method: context.method?.slice(0, 12),
      route: context.route ? safePath(context.route) : undefined,
      status: context.status,
      durationMs: context.durationMs,
      userId: context.userId?.slice(0, 120),
      organizationId: context.organizationId?.slice(0, 120),
      projectId: context.projectId?.slice(0, 120),
      operation: context.operation
        ? redactText(context.operation, 180)
        : undefined,
      queue: context.queue?.slice(0, 100),
      jobId: context.jobId?.slice(0, 120),
      componentStack: context.componentStack
        ? redactText(context.componentStack, 6000)
        : undefined,
      tags: safeTags(context.tags),
    };
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          source,
          options.environment,
          context.kind,
          details.name,
          details.message.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id"),
          safeContext.method,
          safeContext.route,
          details.stack.split("\n").slice(1, 3),
        ]),
      )
      .digest("hex")
      .slice(0, 16);
    return {
      ...details,
      id: randomUUID(),
      source,
      kind: context.kind ?? "runtime",
      level:
        context.kind === "fatal"
          ? "fatal"
          : context.status && context.status < 500
            ? "warning"
            : "error",
      context: safeContext,
      server:
        source === "backend"
          ? {
              node: process.version,
              pid: process.pid,
              uptimeSeconds: Math.round(process.uptime()),
              rssMB: Math.round(process.memoryUsage().rss / 1048576),
              heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1048576),
            }
          : undefined,
      occurredAt: occurredAt ?? receivedAt,
      receivedAt,
      environment: options.environment,
      release: options.release,
      fingerprint,
      count: 1,
      lastSeenAt: occurredAt ?? receivedAt,
    };
  }
  const service = {
    capture(error: unknown, context: ErrorContext = {}) {
      if (
        !options.enabled ||
        context.queue === "error-reports" ||
        context.tags?.queue === "error-reports"
      )
        return;
      if (error && typeof error === "object") {
        if (seen.has(error) && now() - seen.get(error)! < 1000) return;
        seen.set(error, now());
      }
      try {
        return accept(base(error, "backend", context));
      } catch {
        options.onFailure("capture_failed");
      }
    },
    frontend(
      input: FrontendErrorInput,
      actor: ErrorActor = {},
    ): string | undefined {
      if (!options.enabled) return;
      const eventKey = `${actor.userId ?? "anonymous"}:${input.sessionId}:${input.id}`;
      const previous = clientEvents.get(eventKey);
      if (previous && now() - previous.at < 10 * 60_000) return previous.id;
      if (clientEvents.size >= 2000)
        clientEvents.delete(clientEvents.keys().next().value!);
      const error = new Error(input.message);
      error.name = input.name;
      error.stack = input.stack ?? "";
      const occurredAt =
        Number.isFinite(Date.parse(input.occurredAt)) &&
        Math.abs(now() - Date.parse(input.occurredAt)) < 24 * 60 * 60_000
          ? input.occurredAt
          : undefined;
      const report = base(
        error,
        "frontend",
        {
          ...actor,
          kind: input.kind,
          componentStack: input.componentStack,
          ...input.request,
          route: safePath(input.request?.path ?? input.route),
          projectId: safePath(input.route).match(
            /^\/projects?\/([A-Za-z0-9_-]{1,120})(?:\/|$)/,
          )?.[1],
        },
        occurredAt,
      );
      report.count = input.occurrences ?? 1;
      report.client = {
        eventId: input.id,
        occurredAt: report.occurredAt,
        release: redactText(input.release ?? "unknown", 120),
        route: safePath(input.route),
        sessionId: input.sessionId.slice(0, 64),
        browser: {
          ...input.browser,
          userAgent: redactText(input.browser.userAgent, 350),
          language: input.browser.language.slice(0, 30),
          viewport: input.browser.viewport.slice(0, 30),
          visibility: input.browser.visibility.slice(0, 30),
        },
        request: input.request
          ? {
              ...input.request,
              path: safePath(input.request.path),
              requestId: input.request.requestId
                ? redactText(input.request.requestId, 120)
                : undefined,
            }
          : undefined,
        breadcrumbs: input.breadcrumbs
          .slice(-30)
          .map((crumb) => ({
            ...crumb,
            description: redactText(crumb.description, 300),
            requestId: crumb.requestId
              ? redactText(crumb.requestId, 120)
              : undefined,
          })),
      };
      const id = accept(report);
      clientEvents.set(eventKey, { id, at: now() });
      return id;
    },
    /** Accepts one report or a page-exit batch; returns the last accepted id. */
    frontendBatch(body: FrontendErrorBody, actor: ErrorActor = {}): string | null {
      const entries = "reports" in body ? body.reports : [body];
      let id: string | undefined;
      for (const entry of entries) id = service.frontend(entry, actor);
      return id ?? null;
    },
    async flush(timeoutMs = 2000) {
      for (const group of groups.values())
        if (group.repeats) {
          deliver({
            ...group.report,
            count: group.repeats,
            lastSeenAt: group.lastSeenAt,
          });
          group.repeats = 0;
        }
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        Promise.allSettled([...pending]),
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
    },
  };
  return service;
}
export type ErrorReportService = ReturnType<typeof errorReportService>;
