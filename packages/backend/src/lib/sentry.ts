import { captureError } from "../modules/error-reports/runtime.ts";
import * as Sentry from "@sentry/node";

export interface BugContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Report swallowed errors to each configured sink. Sentry uses an isolation
 * scope so tags never leak across concurrent jobs. Slack works without a DSN.
 */
export function captureBug(error: unknown, context: BugContext = {}): void {
  captureError(error, {
    kind: "background",
    tags: { ...context.tags, ...context.extra },
  });
  Sentry.withIsolationScope(() => {
    Sentry.captureException(error, {
      tags: context.tags,
      extra: context.extra,
    });
  });
}
