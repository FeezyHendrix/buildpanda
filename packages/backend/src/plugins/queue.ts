import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { QueueManager } from "../lib/queue/index.ts";
import { config } from "../config/index.ts";
import { registerPandaAiWorker } from "../modules/panda-ai/job.ts";
import { registerProposalExpiryWorker } from "../modules/proposals/expiry-job.ts";
import { registerActionItemReminderWorker } from "../modules/action-items/reminder-job.ts";
import { registerRfiReminderWorker } from "../modules/rfis/reminder-job.ts";
import { registerBimProcessingWorker } from "../modules/bim/job.ts";
import { registerBoqImportWorker } from "../modules/materials-equipment/boq-job.ts";
import { registerProgrammeImportWorker } from "../modules/panda-ai/programme/job.ts";
import { registerProgressRecomputeWorker } from "../modules/activities/progress-job.ts";

declare module "fastify" {
  interface FastifyInstance {
    queue: QueueManager;
  }
}

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  const manager = new QueueManager(config.redis.url || null, fastify.log);

  const inlineModeRequiresLocalWorkers = manager.mode === "inline";
  const runWorkers = inlineModeRequiresLocalWorkers || config.worker.runWorkers;

  if (runWorkers) {
    registerPandaAiWorker(fastify.db, manager);
    registerProposalExpiryWorker(fastify.db, manager);
    registerActionItemReminderWorker(fastify.db, manager);
    registerRfiReminderWorker(fastify.db, manager);
    registerBimProcessingWorker(fastify.db, manager);
    registerBoqImportWorker(fastify.db, manager);
    registerProgrammeImportWorker(fastify.db, manager);
    registerProgressRecomputeWorker(fastify.db, manager);
    manager.startWorkers();
  }

  fastify.decorate("queue", manager);

  fastify.addHook("onClose", async () => {
    await manager.close();
  });

  fastify.log.info({ mode: manager.mode, runWorkers }, "Queue manager ready");
};

export default fp(queuePlugin, { name: "queue", dependencies: ["database"] });
