import type { Knex } from "knex";
import { messagingAgentAccess } from "./access.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import { parseReviewButtonCommand, validReviewButtons } from "./reply-buttons.ts";
import type { MessagingOutboxRow } from "./types.ts";
import { type MessagingWorkerDependencies } from "./worker-types.ts";

export async function deliverMessagingOutbox(db: Knex, row: MessagingOutboxRow, deps: MessagingWorkerDependencies): Promise<void> {
  // Hold connection/scope locks through the bounded provider call so unlink or
  // scope changes cannot authorize an already obsolete protected delivery.
  await db.transaction(async (trx) => {
    const repo = messagingAgentRepository(trx);
    const source = await repo.inbox(row.inbox_id);
    const cancel = (reason: string) => repo.finishOutbox(row.id, "cancelled", undefined, reason);
    const adapter = deps.adapters.find(row.channel, row.channel_account_id);
    const limit = row.buttons ? adapter?.maxButtonTextLength ?? adapter?.maxTextLength : adapter?.maxTextLength;
    if (!source || !adapter || source.channel !== row.channel || source.channel_account_id !== row.channel_account_id ||
      source.reply_recipient_id !== row.recipient_id || source.conversation_type !== "direct" || source.origin === "web" || !limit || row.body.length > limit) {
      await cancel("Receiving number or sender changed"); return;
    }
    if (!row.identity_id) {
      const linked = await repo.identityForSender({ channel: source.channel, channelAccountId: source.channel_account_id, senderId: source.sender_id });
      if (source.identity_id || row.conversation_id || row.scope_version || linked?.opted_out_at || !adapter.canReply(source.sent_at, deps.now())) {
        await cancel("Generic reply is no longer deliverable"); return;
      }
    } else {
      const identity = await messagingAgentReadRepository(trx).lockIdentity(row.identity_id);
      const conversation = row.conversation_id ? await repo.lockConversation(row.conversation_id) : null;
      if (!identity || identity.revoked_at || identity.opted_out_at || identity.sender_id !== source.sender_id ||
        identity.channel !== source.channel || identity.channel_account_id !== source.channel_account_id || !conversation || conversation.identity_id !== identity.id ||
        conversation.paused || conversation.scope_version !== row.scope_version || !adapter.canReply(identity.last_inbound_at, deps.now())) {
        await cancel("Connection, scope, consent or service window changed"); return;
      }
      try {
        const access = await messagingAgentAccess(trx).project(identity.user_id, conversation.project_id);
        if (access.project.organization_id !== conversation.organization_id) throw new Error("Organization changed");
        await messagingAgentAccess(trx).building(access, conversation.building_id);
      } catch {
        await cancel("Current project permissions do not permit delivery"); return;
      }
    }
    if (row.buttons) {
      if (!row.identity_id || !validReviewButtons(row.buttons)) { await cancel("Invalid review buttons"); return; }
      const target = parseReviewButtonCommand(row.buttons[0]!.command)!;
      const proposal = await repo.proposal(target.proposalId);
      if (!proposal || proposal.conversation_id !== row.conversation_id || proposal.scope_version !== row.scope_version ||
        proposal.project_id !== source.project_id || proposal.building_id !== source.building_id || proposal.organization_id !== source.organization_id ||
        proposal.version !== target.version || proposal.status !== "draft") {
        await cancel("Review changed before delivery"); return;
      }
    }
    const result = await adapter.sendText({
      to: row.recipient_id, text: row.body,
      replyToMessageId: source.provider_message_id,
      ...(row.buttons ? { buttons: row.buttons } : {}),
    });
    if (result.status === "accepted") await repo.finishOutbox(row.id, "accepted", result.messageId);
    else if (result.status === "unknown") await repo.finishOutbox(row.id, "unknown", undefined, result.reason);
    else await repo.finishOutbox(row.id, "failed", undefined, result.reason);
  });
}
