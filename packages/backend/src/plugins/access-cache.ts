import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import IORedis, { type Redis } from "ioredis";
import { config } from "../config/index.ts";

interface MemberRoleRow {
  organizationId: string;
  role: string;
}

interface OrgRoleRow {
  organizationId: string;
  role: string;
  permission: string;
}

interface ParticipantRoleRow {
  project_id: string;
  role: string;
  permissions: Record<string, string> | null;
  grants: Record<string, string[]> | null;
}

export interface AccessContextRows {
  memberRows: MemberRoleRow[];
  customRoleRows: OrgRoleRow[];
  participantRows: ParticipantRoleRow[];
}

export interface AccessCache {
  load(userId: string, loader: () => Promise<AccessContextRows>): Promise<AccessContextRows>;
  invalidate(userId: string): Promise<void>;
}

declare module "fastify" {
  interface FastifyInstance {
    accessCache: AccessCache;
  }
}

// TTL is the staleness bound for writes that bypass our modules (better-auth
// org membership/role changes go through /api/auth). Writes we own invalidate
// explicitly, so participant changes apply immediately.
const TTL_SECONDS = 60;
const KEY_PREFIX = "buildpanda:access-ctx:";

function redisCache(redis: Redis, onError: (err: unknown) => void): AccessCache {
  return {
    async load(userId, loader) {
      try {
        const cached = await redis.get(KEY_PREFIX + userId);
        if (cached) return JSON.parse(cached) as AccessContextRows;
      } catch (err) {
        onError(err);
      }
      const rows = await loader();
      try {
        await redis.set(KEY_PREFIX + userId, JSON.stringify(rows), "EX", TTL_SECONDS);
      } catch (err) {
        onError(err);
      }
      return rows;
    },
    async invalidate(userId) {
      try {
        await redis.del(KEY_PREFIX + userId);
      } catch (err) {
        onError(err);
      }
    },
  };
}

function memoryCache(): AccessCache {
  const store = new Map<string, { rows: AccessContextRows; expiresAt: number }>();
  return {
    async load(userId, loader) {
      const cached = store.get(userId);
      if (cached && cached.expiresAt > Date.now()) return cached.rows;
      const rows = await loader();
      store.set(userId, { rows, expiresAt: Date.now() + TTL_SECONDS * 1000 });
      return rows;
    },
    async invalidate(userId) {
      store.delete(userId);
    },
  };
}

const accessCachePlugin: FastifyPluginAsync = async (fastify) => {
  if (config.redis.url) {
    const redis = new IORedis(config.redis.url, { maxRetriesPerRequest: 1 });
    redis.on("error", (err) => fastify.log.error({ err }, "Access cache redis error"));
    fastify.decorate(
      "accessCache",
      redisCache(redis, (err) => fastify.log.warn({ err }, "Access cache degraded to DB load")),
    );
    fastify.addHook("onClose", async () => {
      await redis.quit().catch(() => undefined);
    });
  } else {
    fastify.decorate("accessCache", memoryCache());
  }
};

export default fp(accessCachePlugin, { name: "access-cache" });
