import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { QueueManager } from "../lib/queue/index.ts";
import { config } from "../config/index.ts";
import { registerPandaAiWorker } from "../modules/panda-ai/job.ts";
import { registerProposalExpiryWorker } from "../modules/proposals/expiry-job.ts";
import { registerActionItemReminderWorker } from "../modules/action-items/reminder-job.ts";
import { registerBoqImportWorker } from "../modules/materials-equipment/boq-job.ts";
import { registerProgrammeImportWorker } from "../modules/panda-ai/programme/job.ts";

declare module "fastify" {
  interface FastifyInstance {
    queue: QueueManager;
  }
}

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const manager = new QueueManager(config.redis.url || null, fastify.log);

  registerPandaAiWorker(fastify.db, manager);
  registerProposalExpiryWorker(fastify.db, manager);
  registerActionItemReminderWorker(fastify.db, manager);
  registerBoqImportWorker(fastify.db, manager);
  registerProgrammeImportWorker(fastify.db, manager);
  manager.startWorkers();

  fastify.decorate("queue", manager);

  fastify.addHook("onClose", async () => {
    await manager.close();
  });

  fastify.log.info({ mode: manager.mode }, "Queue manager ready");
};

export default fp(queuePlugin, { name: "queue", dependencies: ["database"] });
