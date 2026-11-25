import { MESSAGING_CHANNEL } from "../../types.ts";
import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../../../../config/index.ts";
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from "../../../../lib/errors.ts";
import { messagingAgentIntake } from "../../intake.ts";
import { parseTelegramUpdate } from "./normalize.ts";
import { telegramProvider } from "./provider.ts";
import type { TelegramWebhookOptions } from "./types.ts";

const telegramWebhookRoutes: FastifyPluginAsync<TelegramWebhookOptions> = async (fastify, options) => {
  const settings = options.settings ?? config.telegram;
  const verified = new WeakSet<FastifyRequest>();
  fastify.addHook("onRequest", async (request) => {
    if (!settings.enabled) throw new NotFoundError("Telegram webhook");
    if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      throw new AppError("Telegram webhooks require application/json.", { statusCode: 415, code: "unsupported_media_type" });
    }
    const header = request.headers["x-telegram-bot-api-secret-token"];
    const supplied = Buffer.from(typeof header === "string" ? header : ""), expected = Buffer.from(settings.webhookSecret);
    if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ForbiddenError("Invalid Telegram webhook secret.");
    }
  });
  // Only this parser marks requests verified; inherited encrypted parsers cannot bypass it.
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 1024 * 1024 }, (request, body, done) => {
    verified.add(request);
    try { done(null, JSON.parse((body as Buffer).toString("utf8"))); }
    catch { done(new BadRequestError("Invalid Telegram webhook JSON.")); }
  });
  fastify.post("/telegram/webhook", {
    bodyLimit: 1024 * 1024, logLevel: "warn", config: { messagingWebhook: true },
    schema: { response: { 200: { type: "object", properties: { received: { type: "boolean" } }, required: ["received"], additionalProperties: false } } },
  }, async (request) => {
    if (!verified.has(request)) throw new ForbiddenError("Invalid Telegram webhook secret.");
    const events = parseTelegramUpdate(request.body, settings);
    await messagingAgentIntake(fastify.db).receive({ channel: MESSAGING_CHANNEL.telegram, channelAccountId: settings.botId }, events);
    if (events.callbackQueryId) {
      try {
        const answer = options.answerCallbackQuery ?? ((id: string) => telegramProvider(settings).answerCallbackQuery(id));
        await answer(events.callbackQueryId);
      } catch {
        // Acknowledgement only dismisses Telegram's progress indicator; accepted work stays durable.
        fastify.log.warn("Telegram callback acknowledgement failed");
      }
    }
    return { received: true };
  });
};

export default telegramWebhookRoutes;
