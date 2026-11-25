import { UnrecoverableError } from "bullmq";
import { getLlmContext } from "../../lib/llm-context.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { setImmediate as immediate } from "node:timers/promises";
import { config } from "../../config/index.ts";
import { logger } from "../../lib/logger.ts";
import { errorReportService } from "./service.ts";
import { createSlackTransport } from "./slack.ts";
import {
  ERROR_REPORT_QUEUE,
  type DeliveryJob,
  type ErrorContext,
  type ErrorQueue,
  type ErrorReport,
  type SlackSend,
} from "./types.ts";

const contextStorage = new AsyncLocalStorage<() => ErrorContext>();
let queue: ErrorQueue | undefined;
let emergencySend: SlackSend | undefined;
const startupReports: ErrorReport[] = [];
const deliveries = new Set<Promise<unknown>>();
// `area: "error_sink"` stops the logger hook from capturing these entries again.
const failure = (code: string) => {
  try {
    logger.warn({ area: "error_sink", code }, "Error sink delivery problem");
  } catch {
    /* Reporting must not interrupt the application. */
  }
};
export const errorSink = errorReportService({
  enabled: Boolean(config.errorSink.slackWebhookUrl),
  environment: config.errorSink.environment,
  release: config.errorSink.release,
  record: (report) =>
    logger.error({ area: "error_sink", report }, "Error report captured"),
  enqueue: async (report) => {
    if (queue) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          queue.enqueue(ERROR_REPORT_QUEUE, "deliver", {
            report,
          } satisfies DeliveryJob),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Queue timeout")), 1500);
          }),
        ]);
      } catch {
        failure("queue_unavailable_using_direct_delivery");
        if (emergencySend) await emergencySend(report);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } else if (startupReports.length < 100) startupReports.push(report);
    else failure("startup_queue_full_report_retained_in_logs");
  },
  onFailure: failure,
});
export const withErrorContext = (
  context: () => ErrorContext,
  next: () => void,
) => contextStorage.run(context, next);
export function captureError(error: unknown, context: ErrorContext = {}) {
  const job = getLlmContext();
  const ambient = {
    userId: job?.userId,
    organizationId: job?.orgId,
    jobId: job?.jobId,
    ...contextStorage.getStore()?.(),
  };
  if (ambient.route === "/error-reports") return;
  return errorSink.capture(error, {
    ...ambient,
    ...Object.fromEntries(
      Object.entries(context).filter(([, value]) => value !== undefined),
    ),
  });
}
export function captureErrorLog(
  args: readonly unknown[],
  bindings: Record<string, unknown>,
  level: number,
) {
  const object =
    args[0] && typeof args[0] === "object"
      ? (args[0] as Record<string, unknown>)
      : {};
  if (level < 50 && !(args[0] instanceof Error) && !object.err && !object.error)
    return;
  if (object.queue === ERROR_REPORT_QUEUE || object.area === "error_sink")
    return;
  const error =
    args[0] instanceof Error
      ? args[0]
      : (object.err ??
        object.error ??
        (typeof args[1] === "string"
          ? args[1]
          : typeof args[0] === "string"
            ? args[0]
            : "An error was logged"));
  captureError(error, {
    kind: level >= 60 ? "fatal" : object.queue ? "background" : undefined,
    requestId: typeof bindings.reqId === "string" ? bindings.reqId : undefined,
    operation: typeof args[1] === "string" ? args[1] : undefined,
    queue: typeof object.queue === "string" ? object.queue : undefined,
    jobId: typeof object.jobId === "string" ? object.jobId : undefined,
    tags: object,
  });
}
export async function bindErrorQueue(
  manager: ErrorQueue,
  runWorkers: boolean,
  transport?: SlackSend,
) {
  if (!config.errorSink.slackWebhookUrl && !transport) return;
  let send: SlackSend;
  try {
    send =
      transport ??
      createSlackTransport({ webhookUrl: config.errorSink.slackWebhookUrl });
  } catch {
    failure("invalid_slack_webhook_configuration");
    return;
  }
  emergencySend = send;
  queue = manager;
  if (runWorkers) {
    let nextDelivery = 0;
    manager.registerProcessor<DeliveryJob>(
      ERROR_REPORT_QUEUE,
      async (job) => {
        const attempt = async () => {
          const wait = Math.max(0, nextDelivery - Date.now());
          nextDelivery = Math.max(nextDelivery, Date.now()) + 1000;
          if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
          try {
            const retryAfter = await send(job.report);
            if (retryAfter)
              await manager.enqueue(ERROR_REPORT_QUEUE, "rate-limited", job, {
                delayMs: retryAfter,
              });
          } catch (error) {
            if (error instanceof UnrecoverableError || (job.retry ?? 0) >= 7)
              throw error;
            await manager.enqueue(
              ERROR_REPORT_QUEUE,
              "retry",
              { ...job, retry: (job.retry ?? 0) + 1 },
              { delayMs: Math.min(5000 * 2 ** (job.retry ?? 0), 300_000) },
            );
          }
        };
        const pending = attempt();
        deliveries.add(pending);
        try {
          await pending;
        } finally {
          deliveries.delete(pending);
        }
      },
      { concurrency: 1, limiter: { max: 1, duration: 1000 } },
    );
  }
  for (const report of startupReports.splice(0))
    await manager.enqueue(ERROR_REPORT_QUEUE, "deliver", {
      report,
    } satisfies DeliveryJob);
}
export async function flushErrorSink(timeoutMs = 2000) {
  const end = Date.now() + timeoutMs;
  await errorSink.flush(timeoutMs);
  if (!queue && config.errorSink.slackWebhookUrl) {
    try {
      const send = createSlackTransport({
        webhookUrl: config.errorSink.slackWebhookUrl,
      });
      for (const report of startupReports.splice(0)) {
        const pending = send(report).catch(() =>
          failure("startup_delivery_failed"),
        );
        deliveries.add(pending);
        void pending.finally(() => deliveries.delete(pending));
      }
    } catch {
      failure("invalid_webhook_url");
    }
  }
  await immediate();
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled([...deliveries]),
    new Promise((resolve) => {
      timer = setTimeout(resolve, Math.max(1, end - Date.now()));
    }),
  ]);
  if (timer) clearTimeout(timer);
}

/** Last resort when the process cannot start: report, flush, then exit. */
export async function failStartup(error: unknown, message: string) {
  captureError(error, { kind: "fatal", operation: "startup" });
  await flushErrorSink(2000);
  logger.error({ area: "error_sink" }, message);
  process.exit(1);
}
