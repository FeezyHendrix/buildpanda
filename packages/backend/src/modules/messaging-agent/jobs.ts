import type { Knex } from "knex";
import type { FastifyBaseLogger } from "fastify";
import { configuredMessagingAdapters } from "./adapters/index.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { messagingAgentWorker } from "./worker.ts";

export const MESSAGING_AGENT_INBOX_QUEUE = "messaging-agent-inbox";
export const MESSAGING_AGENT_OUTBOX_QUEUE = "messaging-agent-outbox";
export const MESSAGING_AGENT_SWEEP_QUEUE = "messaging-agent-sweep";

export function registerMessagingWorker(db: Knex, queue: QueueManager, log: FastifyBaseLogger): void {
  const adapters = configuredMessagingAdapters();
  if (!adapters.list().length) return;
  const worker = messagingAgentWorker(db, { adapters, queue });
  queue.registerProcessor<{ inboxId: string }>(MESSAGING_AGENT_INBOX_QUEUE, ({ inboxId }) => worker.processInbox(inboxId));
  queue.registerProcessor<{ outboxId: string }>(MESSAGING_AGENT_OUTBOX_QUEUE, ({ outboxId }) => worker.processOutbox(outboxId));
  queue.startRepeating(MESSAGING_AGENT_SWEEP_QUEUE, 10_000, async () => {
    try { await worker.tick(); }
    catch (error) { log.error({ err: error }, "Messaging durable sweep failed"); throw error; }
  }, {});
}
