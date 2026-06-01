import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { QueueManager } from "../lib/queue/index.ts";
import { config } from "../config/index.ts";
import { registerPandaAiWorker } from "../modules/panda-ai/job.ts";

declare module "fastify" {
  interface FastifyInstance {
    queue: QueueManager;
  }
}

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const manager = new QueueManager(config.redis.url || null, fastify.log);

  registerPandaAiWorker(fastify.db, manager);
  manager.startWorkers();

  fastify.decorate("queue", manager);

  fastify.addHook("onClose", async () => {
    await manager.close();
  });

  fastify.log.info({ mode: manager.mode }, "Queue manager ready");
};

export default fp(queuePlugin, { name: "queue", dependencies: ["database"] });
