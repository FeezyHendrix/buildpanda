import * as Sentry from "@sentry/node";
import { config } from "./config/index.ts";

if (config.sentry.enabled) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.sentry.release || undefined,
    tracesSampleRate: config.sentry.tracesSampleRate,
    integrations: [Sentry.fastifyIntegration()],
  });
}
