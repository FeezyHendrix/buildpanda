import { createHash } from "node:crypto";
import { generateId } from "../../lib/ids.ts";
import type { MessagingConversationRow, MessagingDb, MessagingInboundMessage, MessagingInboxRow, MessagingSourceKind } from "./types.ts";
import type { MessagingReadAccess } from "./management-types.ts";

export function messagingAgentInboxRepository(db: MessagingDb) {
  return {
    async setReadAccess(id: string, access: MessagingReadAccess): Promise<void> {
      await db("messaging_agent_inbox").where({ id }).update({ read_access: JSON.stringify(access), updated_at: db.fn.now() });
    },
    async acceptMessage(message: MessagingInboundMessage): Promise<MessagingInboxRow | null> {
      const link = message.type === "text" ? /^LINK\s+([A-Za-z0-9_-]{24,128})$/i.exec(message.text?.trim() ?? "") : null;
      return db.transaction(async (trx) => {
        const conversation = await trx<MessagingConversationRow>("messaging_agent_conversations as c")
          .join("messaging_agent_identity_links as i", "i.id", "c.identity_id")
          .where({ "i.channel": message.channel, "i.channel_account_id": message.channelAccountId, "i.sender_id": message.senderId })
          .whereNull("i.revoked_at").select("c.*").forShare("c").first();
        const [row] = await trx<MessagingInboxRow>("messaging_agent_inbox").insert({
        id: generateId("mainbox"), channel: message.channel, channel_account_id: message.channelAccountId,
        provider_message_id: message.providerMessageId, sender_id: message.senderId,
        reply_recipient_id: message.replyRecipientId, conversation_type: message.conversationType,
        origin: message.origin ?? "provider",
        identity_id: conversation?.identity_id ?? null, conversation_id: conversation?.id ?? null,
        organization_id: conversation?.organization_id ?? null, project_id: conversation?.project_id ?? null,
        building_id: conversation?.building_id ?? null, scope_version: conversation?.scope_version ?? null,
        message_type: message.type, source_text: link ? "LINK [code redacted]" : message.text,
        link_code_hash: link ? createHash("sha256").update(link[1]!).digest("hex") : null,
        source_kind: message.type === "audio" ? "voice_translation" : message.type === "attachment" ? "file_attachment" : "text",
        source_file_id: message.origin === "web" ? message.sourceFileId ?? null : null,
        media_id: message.mediaId, media_mime_type: message.mediaMimeType,
        reply_to_message_id: message.replyToMessageId, sent_at: message.sentAt,
      }).onConflict(["channel", "channel_account_id", "origin", "provider_message_id"]).ignore().returning("*");
        return row ?? null;
      });
    },

    async inbox(id: string): Promise<MessagingInboxRow | null> {
      return await db<MessagingInboxRow>("messaging_agent_inbox").where({ id }).first() ?? null;
    },

    async pendingInbox(limit = 50): Promise<MessagingInboxRow[]> {
      return db<MessagingInboxRow>("messaging_agent_inbox").where({ status: "received", origin: "provider" })
        .orderBy("created_at", "asc").limit(Math.min(limit, 200));
    },

    async claimInbox(id: string): Promise<MessagingInboxRow | null> {
      const [row] = await db<MessagingInboxRow>("messaging_agent_inbox").where({ id, status: "received" }).update({
        status: "processing", attempts: db.raw("attempts + 1"), processing_started_at: db.fn.now(), updated_at: db.fn.now(),
      }).returning("*");
      return row ?? null;
    },

    async setInboxContent(id: string, input: { identityId?: string; sourceText?: string; sourceKind?: MessagingSourceKind; sourceFileId?: string }): Promise<void> {
      await db("messaging_agent_inbox").where({ id }).update({
        ...(input.identityId === undefined ? {} : { identity_id: input.identityId }),
        ...(input.sourceText === undefined ? {} : { source_text: input.sourceText }),
        ...(input.sourceKind === undefined ? {} : { source_kind: input.sourceKind }),
        ...(input.sourceFileId === undefined ? {} : { source_file_id: input.sourceFileId }),
        updated_at: db.fn.now(),
      });
    },

    async completeInbox(id: string): Promise<void> {
      await db("messaging_agent_inbox").where({ id, status: "processing" })
        .update({ status: "processed", processing_started_at: null, last_error: null, updated_at: db.fn.now() });
    },

    async failInbox(id: string, error: string): Promise<void> {
      await db("messaging_agent_inbox").where({ id, status: "processing" })
        .update({ status: "failed", last_error: error.slice(0, 1000), processing_started_at: null, updated_at: db.fn.now() });
    },

    async releaseInbox(id: string): Promise<void> {
      await db("messaging_agent_inbox").where({ id, status: "processing" })
        .update({ status: "received", processing_started_at: null, updated_at: db.fn.now() });
    },

    async retryInbox(id: string): Promise<boolean> {
      return !!await db("messaging_agent_inbox").where({ id, status: "failed" })
        .update({ status: "received", last_error: null, updated_at: db.fn.now() });
    },

    async recoverInbox(staleBefore: Date): Promise<number> {
      const interrupted = await db("messaging_agent_inbox").where({ origin: "web" }).where((query) => query
        .where((processing) => processing.where({ status: "processing" }).where("processing_started_at", "<", staleBefore))
        .orWhere((received) => received.where({ status: "received" }).where("created_at", "<", staleBefore)))
        .update({ status: "failed", last_error: "This app draft was interrupted. Send the text again; your original attachment was retained.", processing_started_at: null, updated_at: db.fn.now() });
      const retryable = await db("messaging_agent_inbox").where({ origin: "provider", status: "processing" }).where("processing_started_at", "<", staleBefore)
        .update({ status: "received", processing_started_at: null, updated_at: db.fn.now() });
      return interrupted + retryable;
    },
  };
}
