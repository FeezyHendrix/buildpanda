import { MESSAGING_CHANNEL } from "../../types.ts";
import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { config } from "../../../../config/index.ts";
import { AppError, BadRequestError, ForbiddenError, NotFoundError } from "../../../../lib/errors.ts";
import type { WhatsAppWebhookOptions, WhatsAppVerificationQuery } from "./types.ts";
import { parseWhatsAppWebhook } from "./provider.ts";
import { messagingAgentIntake } from "../../intake.ts";
import { verifyWhatsAppSignature } from "./signature.ts";

const whatsappWebhookRoutes: FastifyPluginAsync<WhatsAppWebhookOptions> = async (fastify, options) => {
  const settings = options.settings ?? config.whatsapp;
  const verified = new WeakSet<FastifyRequest>();
  fastify.addHook("onRequest", async (request) => {
    if (request.method === "POST" && request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      throw new AppError("WhatsApp webhooks require application/json.", { statusCode: 415, code: "unsupported_media_type" });
    }
  });
  // The signature covers the exact bytes; JSON parsing and HTML sanitation must follow it.
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 1024 * 1024 }, (request, body, done) => {
    if (!settings.enabled) return done(new NotFoundError("WhatsApp webhook"));
    const signature = request.headers["x-hub-signature-256"];
    if (!verifyWhatsAppSignature(body as Buffer, typeof signature === "string" ? signature : undefined, settings.appSecret)) {
      return done(new ForbiddenError("Invalid WhatsApp webhook signature."));
    }
    verified.add(request);
    try { done(null, JSON.parse((body as Buffer).toString("utf8"))); }
    catch { done(new BadRequestError("Invalid WhatsApp webhook JSON.")); }
  });
  fastify.get<{ Querystring: WhatsAppVerificationQuery }>("/whatsapp/webhook", {
    logLevel: "warn", config: { messagingWebhook: true },
    schema: { querystring: {
      type: "object", additionalProperties: false,
      required: ["hub.mode", "hub.verify_token", "hub.challenge"],
      properties: {
        "hub.mode": { type: "string", const: "subscribe" },
        "hub.verify_token": { type: "string", minLength: 1, maxLength: 512 },
        "hub.challenge": { type: "string", minLength: 1, maxLength: 256, pattern: "^[0-9]+$" },
      },
    } },
  }, async (request, reply) => {
    if (!settings.enabled) throw new NotFoundError("WhatsApp webhook");
    const supplied = Buffer.from(request.query["hub.verify_token"]);
    const expected = Buffer.from(settings.verifyToken);
    if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ForbiddenError("Invalid WhatsApp verification token.");
    }
    return reply.type("text/plain").send(request.query["hub.challenge"]);
  });
  fastify.post("/whatsapp/webhook", { bodyLimit: 1024 * 1024, logLevel: "warn", config: { messagingWebhook: true } }, async (request) => {
    if (!settings.enabled) throw new NotFoundError("WhatsApp webhook");
    if (!verified.has(request)) throw new ForbiddenError("Invalid WhatsApp webhook signature.");
    const events = parseWhatsAppWebhook(request.body, settings.phoneNumberId);
    await messagingAgentIntake(fastify.db).receive({ channel: MESSAGING_CHANNEL.whatsapp, channelAccountId: settings.phoneNumberId }, events);
    return { received: true };
  });
};

export default whatsappWebhookRoutes;
