import {
  addErrorBreadcrumb,
  errorSinkEnabled,
  reportFrontendError,
  resumeErrorReports,
  flushFrontendReports,
} from "./client";
import { instrumentFetch } from "./network";
import { safePath } from "./redact";

if (errorSinkEnabled && typeof window !== "undefined") {
  window.addEventListener(
    "error",
    (event: Event) => {
      if (event instanceof ErrorEvent)
        reportFrontendError(event.error ?? new Error(event.message), {
          kind: "runtime",
        });
      else if (event.target instanceof HTMLElement) {
        const source =
          event.target.getAttribute("src") ?? event.target.getAttribute("href");
        if (source)
          reportFrontendError(
            new Error(
              `Could not load ${event.target.tagName.toLowerCase()} ${safePath(source)}`,
            ),
            { kind: "resource" },
          );
      }
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) =>
    reportFrontendError(event.reason, { kind: "rejection" }),
  );
  window.addEventListener("online", () => {
    addErrorBreadcrumb({
      type: "lifecycle",
      description: "Connection restored",
    });
    resumeErrorReports();
  });
  window.addEventListener("offline", () =>
    addErrorBreadcrumb({ type: "lifecycle", description: "Connection lost" }),
  );
  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("button,a,[role=button],[data-error-action]")
          : null;
      if (!target) return;
      const label =
        target.getAttribute("data-error-action") ??
        target.getAttribute("data-testid") ??
        target.getAttribute("aria-label") ??
        (target instanceof HTMLButtonElement
          ? target.textContent?.trim().slice(0, 100)
          : undefined) ??
        (target instanceof HTMLAnchorElement
          ? safePath(target.href)
          : undefined) ??
        target.getAttribute("type") ??
        target.tagName.toLowerCase();
      addErrorBreadcrumb({
        type: "action",
        description: `${target.tagName.toLowerCase()}: ${label}`,
      });
    },
    true,
  );
  const navigation = () =>
    addErrorBreadcrumb({
      type: "navigation",
      description: safePath(window.location.href),
    });
  window.addEventListener("popstate", navigation);
  window.addEventListener("pagehide", flushFrontendReports);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushFrontendReports();
  });
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history);
    history[method] = (...args) => {
      const result = original(...args);
      navigation();
      return result;
    };
  }
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      const object =
        args[0] && typeof args[0] === "object"
          ? (args[0] as Record<string, unknown>)
          : undefined;
      const error =
        args.find((value) => value instanceof Error) ??
        (object?.err instanceof Error
          ? object.err
          : object?.error instanceof Error
            ? object.error
            : undefined);
      if (error)
        queueMicrotask(() => reportFrontendError(error, { kind: "console" }));
      else if (level === "error")
        reportFrontendError(args[0], { kind: "console" });
    };
  }
  instrumentFetch();
  navigation();
}
