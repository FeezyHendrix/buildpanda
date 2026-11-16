import { generateId } from "../../lib/ids.ts";
import { ConflictError, NotFoundError } from "../../lib/errors.ts";
import { validReviewButtons } from "./reply-buttons.ts";
import type { MessagingDb, MessagingDeliveryStatus, MessagingInboxRow, MessagingOutboxInput, MessagingOutboxRow, MessagingOutboxStatus } from "./types.ts";

export function messagingAgentOutboxRepository(db: MessagingDb) {
  return {
    async enqueueOutbox(input: MessagingOutboxInput): Promise<MessagingOutboxRow> {
      if (input.buttons !== undefined && !validReviewButtons(input.buttons)) throw new ConflictError("Invalid review buttons");
      const source = await db<MessagingInboxRow>("messaging_agent_inbox").where({ id: input.inboxId }).first();
      if (!source) throw new NotFoundError("Incoming message");
      if (input.recipientId !== source.reply_recipient_id) throw new ConflictError("The reply destination does not match its incoming message");
      const [row] = await db<MessagingOutboxRow>("messaging_agent_outbox").insert({
        id: generateId("maoutbox"), inbox_id: input.inboxId, identity_id: input.identityId,
        channel: source.channel, channel_account_id: source.channel_account_id,
        conversation_id: input.conversationId ?? null, body: input.body, recipient_id: input.recipientId,
        scope_version: input.scopeVersion ?? null, idempotency_key: input.idempotencyKey,
        buttons: input.buttons ? db.raw("?::jsonb", [JSON.stringify(input.buttons)]) : null,
      }).onConflict("idempotency_key").ignore().returning("*");
      if (row) return row;
      const existing = (await db<MessagingOutboxRow>("messaging_agent_outbox").where({ idempotency_key: input.idempotencyKey }).first())!;
      if (existing.inbox_id !== input.inboxId || existing.recipient_id !== input.recipientId) throw new ConflictError("This reply key belongs to another incoming message");
      return existing;
    },

    async outbox(id: string): Promise<MessagingOutboxRow | null> {
      return await db<MessagingOutboxRow>("messaging_agent_outbox").where({ id }).first() ?? null;
    },

    async successfulReplyForInbox(inboxId: string): Promise<MessagingOutboxRow | null> {
      return await db<MessagingOutboxRow>("messaging_agent_outbox").where({ inbox_id: inboxId })
        .whereNot("idempotency_key", `${inboxId}:error`).first() ?? null;
    },

    async cancelPendingReplyErrors(inboxId: string): Promise<void> {
      await db("messaging_agent_outbox").where({ inbox_id: inboxId, status: "pending", idempotency_key: `${inboxId}:error` })
        .update({ status: "cancelled", updated_at: db.fn.now() });
    },

    async pendingOutbox(limit = 50): Promise<MessagingOutboxRow[]> {
      return db<MessagingOutboxRow>("messaging_agent_outbox").where({ status: "pending" })
        .orderBy("created_at", "asc").limit(Math.min(limit, 200));
    },

    async claimOutbox(id: string): Promise<MessagingOutboxRow | null> {
      const [row] = await db<MessagingOutboxRow>("messaging_agent_outbox").where({ id, status: "pending" }).update({
        status: "sending", attempts: db.raw("attempts + 1"), sending_started_at: db.fn.now(), updated_at: db.fn.now(),
      }).returning("*");
      return row ?? null;
    },

    async finishOutbox(id: string, status: MessagingOutboxStatus, providerMessageId?: string, error?: string): Promise<boolean> {
      return !!await db("messaging_agent_outbox").where({ id, status: "sending" }).update({
        status, ...(providerMessageId ? { provider_message_id: providerMessageId } : {}),
        last_error: error?.slice(0, 1000) ?? null, sending_started_at: null, updated_at: db.fn.now(),
      });
    },

    async markDelivery(event: MessagingDeliveryStatus): Promise<void> {
      const previous = event.status === "sent" ? ["accepted", "sent"]
        : event.status === "delivered" ? ["accepted", "sent", "delivered"]
        : event.status === "read" ? ["accepted", "sent", "delivered", "read"]
        : ["accepted", "sent", "failed"];
      await db("messaging_agent_outbox").where({ channel: event.channel, channel_account_id: event.channelAccountId, provider_message_id: event.providerMessageId })
        .modify((query) => { if (event.recipientId) query.where("recipient_id", event.recipientId); }).whereIn("status", previous)
        .update({ status: event.status, updated_at: db.fn.now() });
    },

    async recoverOutbox(staleBefore: Date): Promise<number> {
      // A crashed send may already have been accepted by the provider; never auto-resend.
      return db("messaging_agent_outbox").where({ status: "sending" }).where("sending_started_at", "<", staleBefore)
        .update({ status: "unknown", last_error: "Delivery outcome requires reconciliation", sending_started_at: null, updated_at: db.fn.now() });
    },
  };
}
