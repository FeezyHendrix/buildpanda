import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import rateLimit, { type RateLimitOptions } from "@fastify/rate-limit";
import IORedis from "ioredis";
import { config } from "../config/index.ts";
import { clientIp } from "../lib/client-geo.ts";
import { TooManyRequestsError } from "../lib/errors.ts";

function rateLimitKey(request: FastifyRequest): string {
  return clientIp(request) ?? request.ip;
}

// Tighter caps for unauthenticated, abuse-prone surfaces. Attach per route via
// `{ config: { rateLimit: <export> } }`. @fastify/auth endpoints are guarded by
// better-auth's own internal limiter, so they are intentionally left to the
// global baseline here to avoid double-counting the same request twice.
export const publicTokenRateLimit: RateLimitOptions = {
  max: 30,
  timeWindow: 60_000,
};

export const leadsRateLimit: RateLimitOptions = {
  max: 5,
  timeWindow: 60_000,
};

const securityPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, {
    // This is a JSON API, never an HTML origin, so a restrictive default-src
    // 'none' CSP is safe and blocks any accidental script/embed surface.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // Cross-origin: the SPA and admin panel live on different hosts and must be
    // able to read API responses and presigned-link redirects.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    // HSTS only in production; on localhost it would pin http->https and break
    // the dev server.
    hsts: config.isProduction
      ? { maxAge: 15_552_000, includeSubDomains: true, preload: true }
      : false,
  });

  if (!config.rateLimit.enabled) return;

  const redis =
    config.redis.url.length > 0
      ? new IORedis(config.redis.url, {
          connectTimeout: 500,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        })
      : undefined;

  if (redis) {
    redis.on("error", (err) => fastify.log.error({ err }, "Rate-limit Redis error"));
  } else {
    // In-memory store is per-process: under clustering / multi-instance each
    // worker keeps its own counters, so the effective limit is (max x workers).
    // Acceptable as a backstop; set REDIS_URL in production for a shared store.
    fastify.log.warn("Rate limiting using in-memory store (no REDIS_URL); limits are per-process");
  }

  await fastify.register(rateLimit, {
    global: true,
    max: config.rateLimit.global.max,
    timeWindow: config.rateLimit.global.timeWindow,
    keyGenerator: rateLimitKey,
    ...(redis ? { redis } : {}),
    // The plugin throws whatever this returns; an AppError carries statusCode
    // 429 through the shared error handler so the body matches every other
    // error ({ error, code }).
    errorResponseBuilder: (_request, context) =>
      new TooManyRequestsError(`Rate limit exceeded, retry in ${context.after}`, {
        retryAfter: context.after,
      }),
  });
};

export default fp(securityPlugin, { name: "security" });
