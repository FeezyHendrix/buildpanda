import * as Sentry from "@sentry/node";
import { config } from "./config/index.ts";
import { isTelegramApiRequest, stripMessagingWebhookSecret } from "./lib/sentry-messaging-secrets.ts";

if (config.sentry.enabled) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.sentry.release || undefined,
    tracesSampleRate: config.sentry.tracesSampleRate,
    // Bot API URLs contain the credential; omit their spans and breadcrumbs entirely.
    integrations: [Sentry.fastifyIntegration(), Sentry.nativeNodeFetchIntegration({ ignoreOutgoingRequests: isTelegramApiRequest })],
    beforeSend: stripMessagingWebhookSecret,
    beforeSendTransaction: stripMessagingWebhookSecret,
  });
}
