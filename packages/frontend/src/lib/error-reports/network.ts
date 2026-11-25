import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { ERROR_REPORT_PATH } from "@/api/error-reports";
import { addErrorBreadcrumb, reportFrontendError } from "./client";
import { safePath } from "./redact";

const starts = new WeakMap<object, number>();
export const isErrorReportRequest = (url: string) =>
  safePath(url).endsWith(ERROR_REPORT_PATH);
export function beginApiRequest(config: InternalAxiosRequestConfig) {
  starts.set(config, performance.now());
  addErrorBreadcrumb({
    type: "http",
    description: `${config.method?.toUpperCase()} ${safePath(config.url ?? "")} started`,
  });
  return config;
}
export function finishApiRequest(response: AxiosResponse) {
  const durationMs = Math.round(
    performance.now() - (starts.get(response.config) ?? performance.now()),
  );
  addErrorBreadcrumb({
    type: "http",
    description: `${response.config.method?.toUpperCase()} ${safePath(response.config.url ?? "")}`,
    status: response.status,
    durationMs,
    requestId: response.headers["x-request-id"],
  });
  return response;
}
export function failedApiRequest(error: AxiosError) {
  if (error.code === "ERR_CANCELED") return;
  const config = error.config,
    method = config?.method?.toUpperCase() ?? "UNKNOWN",
    path = safePath(config?.url ?? ""),
    status = error.response?.status;
  if (isErrorReportRequest(path)) return;
  const durationMs = Math.round(
    performance.now() -
      (config ? (starts.get(config) ?? performance.now()) : performance.now()),
  );
  const requestId = error.response?.headers["x-request-id"] as
    | string
    | undefined;
  addErrorBreadcrumb({
    type: "http",
    description: `${method} ${path}`,
    status,
    durationMs,
    requestId,
  });
  reportFrontendError(error, {
    kind: "http",
    request: { method, path, status, durationMs, requestId },
  });
}
export function instrumentFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (isErrorReportRequest(url)) return original(input, init);
    const started = performance.now(),
      method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
    const path = safePath(url);
    addErrorBreadcrumb({
      type: "http",
      description: `${method} ${path} started`,
    });
    try {
      const response = await original(input, init),
        durationMs = Math.round(performance.now() - started),
        requestId = response.headers.get("X-Request-ID") ?? undefined;
      addErrorBreadcrumb({
        type: "http",
        description: `${method} ${path}`,
        status: response.status,
        durationMs,
        requestId,
      });
      if (!response.ok)
        reportFrontendError(
          new Error(`HTTP ${response.status} for ${method} ${path}`),
          {
            kind: "http",
            request: {
              method,
              path,
              status: response.status,
              durationMs,
              requestId,
            },
          },
        );
      return response;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const durationMs = Math.round(performance.now() - started);
        addErrorBreadcrumb({
          type: "http",
          description: `${method} ${path} failed`,
          durationMs,
        });
        reportFrontendError(error, {
          kind: "http",
          request: { method, path, durationMs },
        });
      }
      throw error;
    }
  };
}
