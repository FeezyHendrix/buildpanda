import type { FastifyPluginAsync } from "fastify";
import whatsappWebhookRoutes from "./whatsapp/webhook-routes.ts";
import { config } from "../../../config/index.ts";
import { messagingAdapterRegistry } from "../channels.ts";
import { whatsappChannelAdapter } from "./whatsapp/adapter.ts";
import { telegramChannelAdapter } from "./telegram/adapter.ts";
import telegramWebhookRoutes from "./telegram/webhook-routes.ts";

export function configuredMessagingAdapters() {
  const adapters = config.whatsapp.enabled ? [whatsappChannelAdapter(config.whatsapp)] : [];
  if (config.telegram.enabled) adapters.push(telegramChannelAdapter(config.telegram));
  if (adapters.length && config.isProduction && !config.redis.url) throw new Error("Messaging Agent requires REDIS_URL in production");
  return messagingAdapterRegistry(adapters);
}

export const messagingAdapterRoutes: FastifyPluginAsync = async (app) => {
  await app.register(whatsappWebhookRoutes);
  await app.register(telegramWebhookRoutes);
};
