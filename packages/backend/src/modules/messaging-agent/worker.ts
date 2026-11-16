import type { Knex } from "knex";
import { BadRequestError, ConflictError, isAppError } from "../../lib/errors.ts";
import { translateAudioToEnglish } from "../../lib/speech.ts";
import { runWithLlmContext } from "../../lib/llm-context.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { draftDailyActions } from "./draft.ts";
import { messagingAgentRepository } from "./repository.ts";
import { enqueueMessagingReply, handleMessagingInbox } from "./worker-inbox.ts";
import { deliverMessagingOutbox } from "./worker-outbox.ts";
import type { MessagingWorkerDependencies, MessagingWorkerOptions } from "./worker-types.ts";

export function messagingAgentWorker(db: Knex, options: MessagingWorkerOptions) {
  const deps: MessagingWorkerDependencies = {
    adapters: options.adapters,
    files: options.files ?? filesService(filesRepository(db)), translate: options.translate ?? translateAudioToEnglish,
    draft: options.draft ?? draftDailyActions, now: options.now ?? (() => new Date()),
    queue: options.queue,
  };
  const repo = messagingAgentRepository(db);

  async function processInbox(id: string): Promise<void> {
    const pending = await repo.inbox(id);
    if (!pending || pending.origin === "web") return;
    const inbox = await repo.claimInbox(id);
    if (!inbox) return;
    const adapter = deps.adapters.find(inbox.channel, inbox.channel_account_id);
    if (!adapter || inbox.conversation_type !== "direct") {
      await repo.failInbox(id, "Channel unavailable or conversation is not private"); return;
    }
    try {
      if (await repo.successfulReplyForInbox(inbox.id)) { await repo.completeInbox(id); return; }
      await runWithLlmContext({ orgId: inbox.organization_id ?? undefined, jobId: inbox.id, source: "job" },
        () => handleMessagingInbox(db, inbox, deps));
      await repo.completeInbox(id);
    } catch (error) {
      const safeMessage = error instanceof BadRequestError || error instanceof ConflictError ? error.message
        : isAppError(error) && error.statusCode < 500 ? "Your account or project access changed. Open the app to check your connection and selected project."
        : "Panda could not process this message. Your source was retained; open the app or send a new message to try again.";
      await repo.failInbox(id, isAppError(error) ? error.message : "Messaging processing failed");
      await enqueueMessagingReply(db, inbox, safeMessage, adapter.maxTextLength, undefined, "error");
    }
  }

  async function processOutbox(id: string): Promise<void> {
    const row = await repo.claimOutbox(id);
    if (!row) return;
    try { await deliverMessagingOutbox(db, row, deps); }
    catch {
      // Once sending starts, a thrown error cannot prove the provider rejected it.
      await repo.finishOutbox(id, "unknown", undefined, "Delivery outcome requires reconciliation");
    }
  }

  async function tickInbox(): Promise<void> {
    await repo.recoverInbox(new Date(deps.now().getTime() - 15 * 60_000));
    for (const row of await repo.pendingInbox()) await processInbox(row.id);
  }

  async function tickOutbox(): Promise<void> {
    await repo.recoverOutbox(new Date(deps.now().getTime() - 2 * 60_000));
    for (const row of await repo.pendingOutbox()) await processOutbox(row.id);
  }

  return { processInbox, processOutbox, tickInbox, tickOutbox, async tick() { await tickInbox(); await tickOutbox(); } };
}
