import { ConflictError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { messagingAgentInboxRepository } from "./repository-inbox.ts";
import { messagingAgentProposalRepository } from "./repository-proposals.ts";
import { messagingAgentOutboxRepository } from "./repository-outbox.ts";
import type {
  MessagingConversationRow, MessagingDb, MessagingIdentityRow, MessagingLinkCodeInput,
  MessagingChannelAccount, MessagingLinkCodeRow, MessagingScope, MessagingSender,
} from "./types.ts";

export function messagingAgentRepository(db: MessagingDb) {
  return {
    ...messagingAgentInboxRepository(db),
    ...messagingAgentProposalRepository(db),
    ...messagingAgentOutboxRepository(db),

    async createLinkCode(input: MessagingLinkCodeInput): Promise<MessagingLinkCodeRow> {
      const [row] = await db<MessagingLinkCodeRow>("messaging_agent_link_codes").insert({
        id: generateId("malink"), user_id: input.userId, organization_id: input.organizationId,
        project_id: input.projectId, building_id: input.buildingId,
        channel: input.channel, channel_account_id: input.channelAccountId,
        code_hash: input.codeHash, expires_at: input.expiresAt,
      }).returning("*");
      return row!;
    },

    async readLinkCode(codeHash: string, account: MessagingChannelAccount, now = new Date()): Promise<MessagingLinkCodeRow | null> {
      return await db<MessagingLinkCodeRow>("messaging_agent_link_codes").where({ code_hash: codeHash, channel: account.channel, channel_account_id: account.channelAccountId })
        .whereNull("consumed_at").where("expires_at", ">", now).first() ?? null;
    },

    async consumeLinkCode(codeHash: string, sender: MessagingSender, now = new Date(), inboundAt = now) {
      return db.transaction(async (trx) => {
        const code = await trx<MessagingLinkCodeRow>("messaging_agent_link_codes")
          .where({ code_hash: codeHash, channel: sender.channel, channel_account_id: sender.channelAccountId })
          .whereNull("consumed_at").where("expires_at", ">", now).forUpdate().first();
        if (!code) return null;
        // Different codes for one sender must not race to attach two accounts.
        await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [JSON.stringify(["messaging-agent", sender.channel, sender.channelAccountId, sender.senderId])]);
        let identity = await trx<MessagingIdentityRow>("messaging_agent_identity_links")
          .where({ channel: sender.channel, channel_account_id: sender.channelAccountId, sender_id: sender.senderId })
          .whereNull("revoked_at").forUpdate().first();
        if (identity && identity.user_id !== code.user_id) return null;
        if (!identity) {
          [identity] = await trx<MessagingIdentityRow>("messaging_agent_identity_links").insert({
            id: generateId("maidentity"), channel: sender.channel, channel_account_id: sender.channelAccountId,
            sender_id: sender.senderId, user_id: code.user_id, last_inbound_at: inboundAt,
          }).returning("*");
        } else {
          [identity] = await trx<MessagingIdentityRow>("messaging_agent_identity_links").where({ id: identity.id })
            .update({ opted_out_at: null, last_inbound_at: trx.raw("GREATEST(last_inbound_at, ?::timestamptz)", [inboundAt]), updated_at: now }).returning("*");
        }
        if (!identity) throw new ConflictError("Could not link this Messaging identity");
        let conversation = await trx<MessagingConversationRow>("messaging_agent_conversations")
          .where({ identity_id: identity.id }).forUpdate().first();
        const scope = { organizationId: code.organization_id, projectId: code.project_id, buildingId: code.building_id };
        if (conversation) {
          conversation = await messagingAgentRepository(trx).setScope(conversation.id, scope);
        } else {
          [conversation] = await trx<MessagingConversationRow>("messaging_agent_conversations").insert({
            id: generateId("maconversation"), identity_id: identity.id, organization_id: scope.organizationId,
            project_id: scope.projectId, building_id: scope.buildingId,
          }).returning("*");
        }
        await trx("messaging_agent_link_codes").where({ id: code.id }).update({ consumed_at: now });
        return { identity, conversation: conversation! };
      });
    },

    async identityForSender(sender: MessagingSender): Promise<MessagingIdentityRow | null> {
      return await db<MessagingIdentityRow>("messaging_agent_identity_links")
        .where({ channel: sender.channel, channel_account_id: sender.channelAccountId, sender_id: sender.senderId }).whereNull("revoked_at").first() ?? null;
    },

    async identitiesForUser(userId: string): Promise<MessagingIdentityRow[]> {
      return db<MessagingIdentityRow>("messaging_agent_identity_links").where({ user_id: userId }).whereNull("revoked_at").orderBy("created_at", "desc");
    },

    async revokeIdentity(identityId: string, userId: string): Promise<boolean> {
      return db.transaction(async (trx) => {
        const count = await trx("messaging_agent_identity_links").where({ id: identityId, user_id: userId }).whereNull("revoked_at")
          .update({ revoked_at: trx.fn.now(), updated_at: trx.fn.now() });
        if (!count) return false;
        await trx("messaging_agent_conversations").where({ identity_id: identityId })
          .update({ paused: true, scope_version: trx.raw("scope_version + 1"), updated_at: trx.fn.now() });
        await trx("messaging_agent_outbox").where({ identity_id: identityId }).whereIn("status", ["pending", "sending"])
          .update({ status: "cancelled", updated_at: trx.fn.now() });
        return true;
      });
    },

    async setOptOut(identityId: string, optedOut: boolean): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("messaging_agent_identity_links").where({ id: identityId }).whereNull("revoked_at")
          .update({ opted_out_at: optedOut ? trx.fn.now() : null, updated_at: trx.fn.now() });
        if (optedOut) await trx("messaging_agent_outbox").where({ identity_id: identityId, status: "pending" })
          .update({ status: "cancelled", updated_at: trx.fn.now() });
      });
    },

    async touchIdentity(identityId: string, sentAt: Date): Promise<void> {
      await db("messaging_agent_identity_links").where({ id: identityId }).whereNull("revoked_at")
        .update({ last_inbound_at: db.raw("GREATEST(last_inbound_at, ?::timestamptz)", [sentAt]), updated_at: db.fn.now() });
    },

    async conversation(identityId: string): Promise<MessagingConversationRow | null> {
      return await db<MessagingConversationRow>("messaging_agent_conversations").where({ identity_id: identityId }).first() ?? null;
    },

    async lockConversation(id: string): Promise<MessagingConversationRow | null> {
      if (!db.isTransaction) throw new Error("Conversation locking requires a transaction");
      return await db<MessagingConversationRow>("messaging_agent_conversations").where({ id }).forUpdate().first() ?? null;
    },

    async setScope(id: string, scope: MessagingScope): Promise<MessagingConversationRow> {
      return db.transaction(async (trx) => {
        const conversation = await trx<MessagingConversationRow>("messaging_agent_conversations").where({ id }).forUpdate().first();
        if (!conversation) throw new ConflictError("Messaging conversation is no longer available");
        const [updated] = await trx<MessagingConversationRow>("messaging_agent_conversations").where({ id }).update({
          organization_id: scope.organizationId, project_id: scope.projectId, building_id: scope.buildingId,
          scope_version: conversation.scope_version + 1, updated_at: trx.fn.now(),
        }).returning("*");
        await trx("messaging_agent_proposals").where({ conversation_id: id }).whereIn("status", ["draft", "confirmed"])
          .update({ status: "cancelled", updated_at: trx.fn.now() });
        await trx("messaging_agent_outbox").where({ conversation_id: id, status: "pending" })
          .update({ status: "cancelled", updated_at: trx.fn.now() });
        return updated!;
      });
    },
  };
}

export type MessagingRepository = ReturnType<typeof messagingAgentRepository>;
