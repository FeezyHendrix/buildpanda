import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { QueueManager } from "../lib/queue/index.ts";
import { config } from "../config/index.ts";
import { registerPandaAiWorker } from "../modules/panda-ai/job.ts";
import { registerPandaAiPeriodicScheduler } from "../modules/panda-ai/periodic-scheduler.ts";
import { registerNotificationEmailWorker } from "../modules/notifications/email-job.ts";
import { registerNotificationPushWorker } from "../modules/notifications/push-job.ts";
import { registerChatEmailWorker } from "../modules/messaging/chat-email-job.ts";
import { registerInvoiceOverdueWorker } from "../modules/invoices/overdue-job.ts";
import { registerInvoiceEmailWorker } from "../modules/invoices/invoice-send-job.ts";
import { registerPermitExpiryWorker } from "../modules/permits/expiry-job.ts";
import { registerKeyDateReminderWorker } from "../modules/key-dates/reminder-job.ts";
import { registerLifecycleEmailWorker } from "../modules/lifecycle/index.ts";
import { registerDecisionChasingWorker } from "../modules/lifecycle/decision-chasing-job.ts";
import { registerProposalExpiryWorker } from "../modules/proposals/expiry-job.ts";
import { registerActionItemReminderWorker } from "../modules/action-items/reminder-job.ts";
import { registerRfiReminderWorker } from "../modules/rfis/reminder-job.ts";
import { registerBimProcessingWorker } from "../modules/bim/job.ts";
import { registerBoqImportWorker } from "../modules/materials-equipment/boq-job.ts";
import { registerProgrammeImportWorker } from "../modules/panda-ai/programme/job.ts";
import { registerTakeoffWorker } from "../modules/panda-ai/automated-takeoff/job.ts";
import { registerPreconWorker } from "../modules/preconstruction/job.ts";
import { registerProjectFileImportWorker } from "../modules/panda-ai/project-file-job.ts";
import { registerProgressRecomputeWorker } from "../modules/activities/progress-job.ts";
import { registerWeatherImpactWorker } from "../modules/weather/impact-job.ts";
import { registerWeeklyUpdateDraftWorker } from "../modules/updates/weekly-draft-job.ts";

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
    registerTakeoffWorker(fastify.db, manager);
    registerPreconWorker(fastify.db, manager, (payload) => fastify.realtime.publish(payload));
    registerProjectFileImportWorker(fastify.db, manager);
    registerProgressRecomputeWorker(fastify.db, manager);
    registerPandaAiPeriodicScheduler(fastify.db, manager, fastify.log);
    registerNotificationEmailWorker(fastify.db, manager);
    registerNotificationPushWorker(fastify.db, manager);
    registerChatEmailWorker(fastify.db, manager);
    registerInvoiceOverdueWorker(fastify.db, manager);
    registerInvoiceEmailWorker(fastify.db, manager);
    registerPermitExpiryWorker(fastify.db, manager);
    registerKeyDateReminderWorker(fastify.db, manager);
    registerLifecycleEmailWorker(fastify.db, manager);
    registerDecisionChasingWorker(fastify.db, manager, fastify.log);
    registerWeatherImpactWorker(fastify.db, manager, fastify.log);
    registerWeeklyUpdateDraftWorker(fastify.db, manager, fastify.log);
    manager.startWorkers();
  }

  fastify.decorate("queue", manager);

  fastify.addHook("onClose", async () => {
    await manager.close();
  });

  fastify.log.info({ mode: manager.mode, runWorkers }, "Queue manager ready");
};

export default fp(queuePlugin, { name: "queue", dependencies: ["database"] });
