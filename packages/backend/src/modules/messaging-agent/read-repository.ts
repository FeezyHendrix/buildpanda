import type { Knex } from "knex";
import type { MessagingConnectionRow, MessagingOwnedProposal } from "./management-types.ts";
import type { MessagingActionRow, MessagingIdentityRow, MessagingInboxRow, MessagingOutboxRow, MessagingProposalRow } from "./types.ts";

export function messagingAgentReadRepository(db: Knex) {
  return {
    connections: (userId: string) => db("messaging_agent_identity_links as i")
      .join("messaging_agent_conversations as c", "c.identity_id", "i.id")
      .where({ "i.user_id": userId }).whereNull("i.revoked_at")
      .select<MessagingConnectionRow[]>("i.*", db.raw("row_to_json(c) as conversation")).orderBy("i.created_at", "desc"),
    connection: (userId: string, connectionId: string) => db("messaging_agent_identity_links as i")
      .join("messaging_agent_conversations as c", "c.identity_id", "i.id")
      .where({ "i.user_id": userId, "i.id": connectionId }).whereNull("i.revoked_at")
      .select<MessagingConnectionRow[]>("i.*", db.raw("row_to_json(c) as conversation")).first(),
    ownedProposal: (userId: string, projectId: string, proposalId: string) => db("messaging_agent_proposals as p")
      .join("messaging_agent_conversations as c", "c.id", "p.conversation_id")
      .join("messaging_agent_identity_links as i", "i.id", "c.identity_id")
      .where({ "p.id": proposalId, "p.project_id": projectId, "i.user_id": userId }).whereNull("i.revoked_at")
      .select<MessagingOwnedProposal[]>("p.*", "i.id as identity_id", "i.sender_id", "i.channel", "i.channel_account_id").first(),
    proposals: (userId: string, projectId: string, buildingId: string | null, includeHistory: boolean, connectionId: string) => db("messaging_agent_proposals as p")
      .join("messaging_agent_conversations as c", "c.id", "p.conversation_id")
      .join("messaging_agent_identity_links as i", "i.id", "c.identity_id")
      .where({ "i.user_id": userId, "i.id": connectionId, "p.project_id": projectId, "p.building_id": buildingId }).whereNull("i.revoked_at")
      .modify((query) => { if (!includeHistory) query.where("p.status", "draft"); })
      .select<MessagingProposalRow[]>("p.*").orderBy("p.created_at", "desc").limit(50),
    messages: (identityId: string, projectId: string, buildingId: string | null) => db<MessagingInboxRow>("messaging_agent_inbox")
      .where({ identity_id: identityId, project_id: projectId, building_id: buildingId })
      .orderBy("created_at", "desc").limit(50),
    replies: (conversationId: string, scopeVersion: number) => db<MessagingOutboxRow>("messaging_agent_outbox")
      .where({ conversation_id: conversationId, scope_version: scopeVersion }).whereNot("status", "cancelled")
      .orderBy("created_at", "desc").limit(50),
    actionsForProposals: (proposalIds: string[]) => db<MessagingActionRow>("messaging_agent_actions as a")
      .join("messaging_agent_proposals as p", function () { this.on("p.id", "a.proposal_id").andOn("p.version", "a.proposal_version"); })
      .whereIn("p.id", proposalIds).select("a.*").orderBy("a.position", "asc"),
    contextMessages: (conversationId: string, scopeVersion: number, currentId: string) => db<MessagingInboxRow>("messaging_agent_inbox")
      .where({ conversation_id: conversationId, scope_version: scopeVersion }).whereNot("id", currentId)
      .where("created_at", "<=", db("messaging_agent_inbox").where({ id: currentId }).select("created_at"))
      .where("created_at", ">", db("messaging_agent_conversations").where({ id: conversationId }).select(db.raw("coalesce(context_reset_at, to_timestamp(0))")))
      .whereNotNull("source_text").whereNull("read_access").orderBy("created_at", "desc").limit(21),
    recentReadSources: (conversationId: string, scopeVersion: number, currentId: string) => db<MessagingInboxRow>("messaging_agent_inbox")
      .where({ conversation_id: conversationId, scope_version: scopeVersion }).whereNot({ id: currentId }).whereNotNull("read_access")
      .where("created_at", "<=", db("messaging_agent_inbox").where({ id: currentId }).select("created_at"))
      .where("created_at", ">", db("messaging_agent_conversations").where({ id: conversationId }).select(db.raw("coalesce(context_reset_at, to_timestamp(0))")))
      .whereNotNull("source_text").orderBy("created_at", "desc").limit(4),
    async lockIdentity(id: string): Promise<MessagingIdentityRow | undefined> {
      if (!db.isTransaction) throw new Error("Identity locking requires a transaction");
      return db<MessagingIdentityRow>("messaging_agent_identity_links").where({ id }).forUpdate().first();
    },
  };
}
