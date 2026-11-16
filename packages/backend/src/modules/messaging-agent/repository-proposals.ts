import { BadRequestError, ConflictError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type {
  MessagingActionRow, MessagingConversationRow, MessagingDb, MessagingInboxRow, MessagingProposalInput,
  MessagingProposalRow, MessagingProposalStatus, MessagingProposedActionInput,
} from "./types.ts";

function actionRows(proposalId: string, version: number, actions: MessagingProposedActionInput[], clarification?: string | null) {
  if ((!actions.length && !clarification) || actions.length > 20) throw new BadRequestError("Review between 1 and 20 actions at a time");
  return actions.map((action, position) => ({
    id: generateId("maaction"), proposal_id: proposalId, proposal_version: version, position,
    kind: action.kind, title: action.title ?? null, summary: action.summary ?? null,
    payload: JSON.stringify(action.payload),
  }));
}

export function messagingAgentProposalRepository(db: MessagingDb) {
  return {
    async resetContext(conversationId: string): Promise<void> {
      await db("messaging_agent_conversations").where({ id: conversationId }).update({ context_reset_at: db.fn.now() });
    },
    async createProposal(input: MessagingProposalInput): Promise<MessagingProposalRow> {
      return db.transaction(async (trx) => {
        const conversation = await trx<MessagingConversationRow>("messaging_agent_conversations")
          .where({ id: input.conversationId }).forUpdate().first();
        if (!conversation || conversation.scope_version !== input.scopeVersion || conversation.paused) {
          throw new ConflictError("The Messaging conversation changed; review this request again");
        }
        const inbox = await trx<MessagingInboxRow>("messaging_agent_inbox").where({ id: input.inboxId }).first();
        if (!inbox || inbox.conversation_id !== conversation.id || inbox.scope_version !== conversation.scope_version) {
          throw new ConflictError("This message was received in a different project scope; send the request again");
        }
        const existing = await trx<MessagingProposalRow>("messaging_agent_proposals").where({ inbox_id: input.inboxId }).first();
        if (existing) {
          if (existing.conversation_id !== input.conversationId) throw new ConflictError("This message belongs to another conversation");
          return existing;
        }
        const id = generateId("maproposal");
        const actions = actionRows(id, 1, input.actions, input.clarification);
        await trx("messaging_agent_proposals").where({ conversation_id: input.conversationId, status: "draft" })
          .update({ status: "cancelled", updated_at: trx.fn.now() });
        const [proposal] = await trx<MessagingProposalRow>("messaging_agent_proposals").insert({
          id, conversation_id: input.conversationId, inbox_id: input.inboxId, scope_version: input.scopeVersion,
          organization_id: conversation.organization_id, project_id: conversation.project_id, building_id: conversation.building_id,
          source_text: input.sourceText, source_kind: input.sourceKind, source_file_id: input.sourceFileId ?? null,
          clarification: input.clarification ?? null,
        }).returning("*");
        if (actions.length) await trx("messaging_agent_actions").insert(actions);
        return proposal!;
      });
    },

    async proposal(id: string): Promise<MessagingProposalRow | null> {
      return await db<MessagingProposalRow>("messaging_agent_proposals").where({ id }).first() ?? null;
    },

    async pendingProposal(conversationId: string): Promise<MessagingProposalRow | null> {
      return await db<MessagingProposalRow>("messaging_agent_proposals").where({ conversation_id: conversationId })
        .whereIn("status", ["draft", "confirmed"]).orderBy("created_at", "desc").first() ?? null;
    },

    async lockProposal(id: string): Promise<MessagingProposalRow | null> {
      if (!db.isTransaction) throw new Error("Proposal locking requires a transaction");
      return await db<MessagingProposalRow>("messaging_agent_proposals").where({ id }).forUpdate().first() ?? null;
    },

    async updateProposal(id: string, expectedVersion: number, actions: MessagingProposedActionInput[], clarification?: string | null): Promise<MessagingProposalRow> {
      return db.transaction(async (trx) => {
        const proposal = await trx<MessagingProposalRow>("messaging_agent_proposals").where({ id }).forUpdate().first();
        if (!proposal || proposal.version !== expectedVersion || proposal.status !== "draft") {
          throw new ConflictError("This review has changed or is already confirmed");
        }
        const version = expectedVersion + 1;
        const newActions = actionRows(id, version, actions);
        const [updated] = await trx<MessagingProposalRow>("messaging_agent_proposals").where({ id }).update({
          version, confirmed_at: null, updated_at: trx.fn.now(),
          ...(clarification !== undefined ? { clarification } : {}),
        }).returning("*");
        await trx("messaging_agent_actions").insert(newActions);
        return updated!;
      });
    },

    async finishProposal(id: string, version: number, status: Exclude<MessagingProposalStatus, "draft">): Promise<boolean> {
      const allowed = status === "confirmed" ? ["draft"] : status === "completed" ? ["confirmed"] : ["draft", "confirmed"];
      return !!await db("messaging_agent_proposals").where({ id, version }).whereIn("status", allowed).update({
        status, ...(status === "confirmed" ? { confirmed_at: db.fn.now() } : {}), updated_at: db.fn.now(),
      });
    },

    async proposalsForUser(userId: string, limit = 50): Promise<MessagingProposalRow[]> {
      return db<MessagingProposalRow>("messaging_agent_proposals as p")
        .join("messaging_agent_conversations as c", "c.id", "p.conversation_id")
        .join("messaging_agent_identity_links as i", "i.id", "c.identity_id")
        .where("i.user_id", userId).whereNull("i.revoked_at")
        .select("p.*").orderBy("p.created_at", "desc").limit(Math.min(limit, 200));
    },

    async actionsForProposal(proposalId: string, version: number): Promise<MessagingActionRow[]> {
      return db<MessagingActionRow>("messaging_agent_actions")
        .where({ proposal_id: proposalId, proposal_version: version }).orderBy("position", "asc");
    },

    async action(id: string): Promise<MessagingActionRow | null> {
      return await db<MessagingActionRow>("messaging_agent_actions").where({ id }).first() ?? null;
    },

    async lockAction(id: string): Promise<MessagingActionRow | null> {
      if (!db.isTransaction) throw new Error("Action locking requires a transaction");
      return await db<MessagingActionRow>("messaging_agent_actions").where({ id }).forUpdate().first() ?? null;
    },

    async completeAction(id: string, result: Record<string, unknown>): Promise<boolean> {
      return !!await db("messaging_agent_actions").where({ id }).whereIn("status", ["proposed", "failed"])
        .update({ status: "committed", result: JSON.stringify(result), last_error: null, updated_at: db.fn.now() });
    },

    async failAction(id: string, error: string): Promise<void> {
      await db("messaging_agent_actions").where({ id }).whereIn("status", ["proposed", "failed"])
        .update({ status: "failed", last_error: error.slice(0, 1000), updated_at: db.fn.now() });
    },
  };
}
