import * as Sentry from "@sentry/node";

export interface BugContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Report a swallowed error (background jobs, email/file/AI side-effects) to
 * Sentry. Uses an isolation scope so tags never leak across concurrent jobs,
 * and is a no-op when Sentry has no configured DSN.
 */
export function captureBug(error: unknown, context: BugContext = {}): void {
  Sentry.withIsolationScope(() => {
    Sentry.captureException(error, {
      tags: context.tags,
      extra: context.extra,
    });
  });
}
