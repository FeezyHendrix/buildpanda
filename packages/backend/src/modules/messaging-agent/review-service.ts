import type { Knex } from "knex";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { dailyLogExecutor } from "../field-actions/index.ts";
import { messagingAgentAccess } from "./access.ts";
import { draftDailyActions, normalizeReview, reviewCommand } from "./draft.ts";
import { proposalDto } from "./mappers.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import type { MessagingReviewAction } from "./management-types.ts";
import type { MessagingConversationRow, MessagingIdentityRow, MessagingInboxRow, MessagingProposalRow } from "./types.ts";

export function messagingAgentReviewService(db: Knex, draft = draftDailyActions) {
  const repo = messagingAgentRepository(db);
  const reads = messagingAgentReadRepository(db);

  async function owned(userId: string, projectId: string, proposalId: string) {
    await messagingAgentAccess(db).project(userId, projectId);
    const proposal = await reads.ownedProposal(userId, projectId, proposalId);
    if (!proposal) throw new NotFoundError("Messaging review");
    return proposal;
  }

  async function dto(proposal: MessagingProposalRow) {
    return proposalDto(proposal, await repo.actionsForProposal(proposal.id, proposal.version));
  }

  return {
    dto,
    async draft(inbox: MessagingInboxRow, identity: MessagingIdentityRow, conversation: MessagingConversationRow, text: string) {
      if (inbox.identity_id !== identity.id || conversation.identity_id !== identity.id ||
        inbox.conversation_id !== conversation.id || inbox.project_id !== conversation.project_id ||
        inbox.building_id !== conversation.building_id || inbox.scope_version !== conversation.scope_version ||
        inbox.channel !== identity.channel || inbox.channel_account_id !== identity.channel_account_id || inbox.sender_id !== identity.sender_id) {
        throw new ForbiddenError("This message belongs to a different Messaging connection or project scope.");
      }
      const access = await messagingAgentAccess(db).project(identity.user_id, conversation.project_id, "create");
      if (access.project.organization_id !== conversation.organization_id || conversation.paused || identity.revoked_at || identity.opted_out_at) {
        throw new ForbiddenError("Reconnect Messaging to an authorized project before capturing work.");
      }
      const building = await messagingAgentAccess(db).building(access, conversation.building_id);
      const pending = await repo.pendingProposal(conversation.id);
      const previous = pending?.status === "draft"
        ? await repo.actionsForProposal(pending.id, pending.version) : [];
      const scope = { projectId: conversation.project_id, organizationId: conversation.organization_id, buildingId: conversation.building_id,
        projectName: access.project.name, buildingName: building.name };
      const actions = await draft(text, scope, previous.map((action) => ({
        kind: action.kind as MessagingReviewAction["kind"], title: action.title ?? "Daily-log action", payload: action.payload,
      })));
      const currentAccess = await messagingAgentAccess(db).project(identity.user_id, conversation.project_id, "create");
      await messagingAgentAccess(db).building(currentAccess, conversation.building_id);
      const currentIdentity = await repo.identityForSender({ channel: identity.channel, channelAccountId: identity.channel_account_id, senderId: identity.sender_id });
      if (currentIdentity?.id !== identity.id || currentIdentity.opted_out_at) {
        throw new ForbiddenError("This Messaging connection is no longer active.");
      }
      const proposal = await repo.createProposal({
        conversationId: conversation.id, inboxId: inbox.id, scopeVersion: conversation.scope_version,
        actions, sourceText: text, sourceKind: inbox.source_kind, sourceFileId: inbox.source_file_id,
      });
      return dto(proposal);
    },
    async edit(userId: string, projectId: string, id: string, version: number, actions: unknown) {
      const proposal = await owned(userId, projectId, id);
      const access = await messagingAgentAccess(db).project(userId, projectId, "create");
      await messagingAgentAccess(db).building(access, proposal.building_id);
      const scope = { organizationId: proposal.organization_id, projectId: proposal.project_id, buildingId: proposal.building_id };
      const normalized = normalizeReview(actions, scope);
      return dto(await repo.updateProposal(id, version, normalized));
    },
    async confirm(userId: string, projectId: string, id: string, version: number) {
      const initial = await owned(userId, projectId, id);
      const completed = await db.transaction(async (trx) => {
        const store = messagingAgentRepository(trx);
        const identity = await messagingAgentReadRepository(trx).lockIdentity(initial.identity_id);
        const conversation = await store.lockConversation(initial.conversation_id);
        const proposal = await store.lockProposal(id);
        if (!identity || identity.user_id !== userId || identity.revoked_at || identity.opted_out_at || !conversation || conversation.paused || !proposal) {
          throw new ForbiddenError("This Messaging connection is no longer active.");
        }
        const access = await messagingAgentAccess(trx).project(userId, projectId, "create");
        await messagingAgentAccess(trx).building(access, proposal.building_id);
        if (proposal.version !== version || proposal.scope_version !== conversation.scope_version || proposal.project_id !== projectId) {
          throw new ConflictError("This review or its project changed. Open the latest review before confirming.");
        }
        if (proposal.status === "completed") return proposal;
        if (proposal.status !== "draft") throw new ConflictError("This review is no longer awaiting confirmation.");
        const actions = await store.actionsForProposal(id, version);
        if (!actions.length) throw new ConflictError("This review has no actions.");
        if (!(await store.finishProposal(id, version, "confirmed"))) throw new ConflictError("This review changed.");
        const scope = { organizationId: proposal.organization_id, projectId: proposal.project_id, buildingId: proposal.building_id };
        for (const action of actions) {
          const command = reviewCommand({ kind: action.kind as MessagingReviewAction["kind"], title: action.title ?? "Daily-log action", payload: action.payload }, scope);
          const result = await dailyLogExecutor(trx).execute(command, { userId, organizationId: scope.organizationId });
          if (!(await store.completeAction(action.id, { ...result }))) throw new ConflictError("This action changed.");
        }
        await store.finishProposal(id, version, "completed");
        return (await store.proposal(id))!;
      });
      return dto(completed);
    },
    async cancel(userId: string, projectId: string, id: string, version: number) {
      const proposal = await owned(userId, projectId, id);
      if (proposal.version !== version || !(await repo.finishProposal(id, version, "cancelled"))) {
        throw new ConflictError("This review changed or has already been saved.");
      }
      return dto((await repo.proposal(id))!);
    },
  };
}
