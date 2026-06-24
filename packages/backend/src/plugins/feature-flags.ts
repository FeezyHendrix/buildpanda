import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { ForbiddenError } from "../lib/errors.ts";
import { FEATURE_FLAGS } from "../modules/feature-flags/definitions.ts";
import { featureFlagsRepository } from "../modules/feature-flags/repository.ts";
import { featureFlagsService } from "../modules/feature-flags/service.ts";

const CACHE_MS = 15_000;

function toRegex(prefix: string): RegExp {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withParams = escaped.replace(/:([A-Za-z0-9_]+)/g, "[^/]+");
  return new RegExp(`^${withParams}(?:/|$)`);
}

const ROUTE_MATCHERS = FEATURE_FLAGS.flatMap((flag) =>
  flag.routePrefixes.map((prefix) => ({ key: flag.key, label: flag.label, pattern: toRegex(prefix) })),
);

const featureFlagsPlugin: FastifyPluginAsync = async (fastify) => {
  const service = featureFlagsService(featureFlagsRepository(fastify.db));
  let cacheAt = 0;
  let cache = new Map<string, boolean>();

  async function enabled(key: string): Promise<boolean> {
    const now = Date.now();
    if (now - cacheAt > CACHE_MS) {
      const settings = await service.getSettings();
      cache = new Map(settings.flags.map((flag) => [flag.key, flag.enabled]));
      cacheAt = now;
    }
    return cache.get(key) ?? true;
  }

  fastify.addHook("onRequest", async (request) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (path.startsWith("/admin") || path === "/feature-flags" || path.startsWith("/api/auth")) return;
    const match = ROUTE_MATCHERS.find((item) => item.pattern.test(path));
    if (!match) return;
    if (!(await enabled(match.key))) {
      throw new ForbiddenError(`${match.label} is currently disabled`);
    }
  });
};

export default fp(featureFlagsPlugin, { name: "feature-flags", dependencies: ["database"] });
