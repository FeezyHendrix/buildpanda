/** Provider verification lives in the route; this exception never opens management APIs. */
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyContextConfig { messagingWebhook?: boolean }
}

export function isMessagingWebhook(request: Pick<FastifyRequest, "method" | "routeOptions">): boolean {
  return (request.method === "GET" || request.method === "POST") && request.routeOptions.config.messagingWebhook === true;
}
