import type { ErrorReportService } from "./service.ts";
import type { QueueManager } from "../../lib/queue/index.ts";

export const ERROR_REPORT_QUEUE = "error-reports";
export const REPORT_KINDS = [
  "runtime",
  "rejection",
  "react",
  "resource",
  "http",
  "query",
  "mutation",
  "console",
  "background",
  "fatal",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export type ErrorLevel = "warning" | "error" | "fatal";
export const BREADCRUMB_TYPES = [
  "navigation",
  "action",
  "http",
  "lifecycle",
] as const;
export type BreadcrumbType = (typeof BREADCRUMB_TYPES)[number];
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "UNKNOWN",
] as const;
export interface ErrorBreadcrumb {
  at: string;
  type: BreadcrumbType;
  description: string;
  method?: string;
  status?: number;
  durationMs?: number;
  requestId?: string;
}
export interface FrontendErrorInput {
  id: string;
  occurrences?: number;
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  kind: ReportKind;
  occurredAt: string;
  release?: string;
  route: string;
  sessionId: string;
  browser: {
    userAgent: string;
    language: string;
    viewport: string;
    online: boolean;
    visibility: string;
  };
  request?: {
    method: string;
    path: string;
    status?: number;
    requestId?: string;
    durationMs?: number;
  };
  breadcrumbs: ErrorBreadcrumb[];
}
export interface ErrorContext {
  kind?: ReportKind;
  requestId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  organizationId?: string;
  projectId?: string;
  operation?: string;
  queue?: string;
  jobId?: string;
  componentStack?: string;
  tags?: Record<string, unknown>;
}
export interface ErrorReport {
  id: string;
  source: "frontend" | "backend";
  kind: ReportKind;
  level: ErrorLevel;
  name: string;
  message: string;
  stack: string;
  causes: string[];
  occurredAt: string;
  receivedAt: string;
  environment: string;
  release: string;
  fingerprint: string;
  context: ErrorContext;
  client?: Omit<
    FrontendErrorInput,
    "name" | "message" | "stack" | "componentStack" | "kind" | "id"
  > & { eventId: string };
  server?: {
    node: string;
    pid: number;
    uptimeSeconds: number;
    rssMB: number;
    heapUsedMB: number;
  };
  count: number;
  lastSeenAt: string;
}
export interface ErrorSinkOptions {
  enabled: boolean;
  environment: string;
  release: string;
  enqueue: (report: ErrorReport) => Promise<void>;
  record: (report: ErrorReport) => void;
  now?: () => number;
  schedule?: (
    callback: () => void,
    delayMs: number,
  ) => { unref?: () => unknown };
  onFailure: (code: string) => void;
}
export type ErrorActor = Pick<ErrorContext, "userId" | "organizationId">;
export interface ReportGroup {
  report: ErrorReport;
  repeats: number;
  lastSeenAt: string;
}
export interface ClientEvent {
  id: string;
  at: number;
}
/** Resolves to a retry delay in ms when Slack rate-limits the delivery. */
export type SlackSend = (report: ErrorReport) => Promise<number | undefined>;
export interface ProjectRouteParams {
  id?: string;
  projectId?: string;
}
export interface SlackTransportOptions {
  webhookUrl: string;
  fetch?: typeof globalThis.fetch;
}
export interface DeliveryJob {
  report: ErrorReport;
  retry?: number;
}
export type ErrorQueue = Pick<QueueManager, "enqueue" | "registerProcessor">;

export interface ErrorReportRouteOptions {
  service?: ErrorReportService;
  origins?: readonly string[];
}

export interface ErrorReportPluginOptions {
  capture?: (error: unknown, context: ErrorContext) => unknown;
}

export type FrontendErrorBody =
  | FrontendErrorInput
  | { reports: FrontendErrorInput[] };
