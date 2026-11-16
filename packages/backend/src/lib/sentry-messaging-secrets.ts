import type { Event } from "@sentry/node";

export function isTelegramApiRequest(value: string): boolean {
  try { return new URL(value).hostname === "api.telegram.org"; }
  catch { return false; }
}

export function stripMessagingWebhookSecret<T extends Event>(event: T): T {
  const headers = event.request?.headers;
  for (const name of Object.keys(headers ?? {})) {
    if (name.toLowerCase() === "x-telegram-bot-api-secret-token") delete headers![name];
  }
  // Provider payloads can contain unconsumed one-time linking codes.
  try {
    if (event.request?.url && ["/telegram/webhook", "/whatsapp/webhook"].includes(new URL(event.request.url).pathname)) {
      delete event.request.data;
    }
  } catch { /* An invalid telemetry URL cannot identify a provider webhook. */ }
  return event;
}
