import type { Knex } from "knex";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.ts";
import { fieldToolsExecutor } from "../field-actions/tools.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { MessagingAnswerResult, MessagingClarificationError } from "./draft-errors.ts";
import { canReadMessagingReviewAction, canWriteMessagingAction, proposalCapabilities, requireMessagingActions } from "./policy.ts";
import { messagingAgentAccess } from "./access.ts";
import { draftDailyActions, normalizeReview } from "./draft.ts";
import { messagingToolDiscovery } from "./tool-discovery.ts";
import { requireCompleteDocumentEvidence } from "./document-review.ts";
import { inspectMessagingFiles } from "./document-intake.ts";
import { documentDestinations } from "./document-routing.ts";
import { messagingSourceFiles, messagingSourceVisibility } from "./source-files.ts";
import { messagingReviewVisibility, requireMessagingReviewTargets } from "./review-access.ts";
import { mayReadAnswer, messagingReadFingerprint } from "./read-access.ts";
import { proposalDto } from "./mappers.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import type { MessagingAccess, MessagingAnswer, MessagingContextMessage, MessagingReviewAction } from "./management-types.ts";
import type { MessagingConversationRow, MessagingIdentityRow, MessagingInboxRow, MessagingProposalRow } from "./types.ts";

export function messagingAgentReviewService(db: Knex, draft = draftDailyActions, queue?: QueueManager) {
  const repo = messagingAgentRepository(db);
  const reads = messagingAgentReadRepository(db);

  async function owned(userId: string, projectId: string, proposalId: string) {
    await messagingAgentAccess(db).project(userId, projectId);
    const proposal = await reads.ownedProposal(userId, projectId, proposalId);
    if (!proposal) throw new NotFoundError("Messaging review");
    return proposal;
  }

  async function dto(proposal: MessagingProposalRow, access?: MessagingAccess) {
    const actions = await repo.actionsForProposal(proposal.id, proposal.version);
    const visible = access ? await messagingReviewVisibility(db, access, { projectId: proposal.project_id, organizationId: proposal.organization_id, buildingId: proposal.building_id }, actions) : [];
    const sourceVisible = !proposal.source_file_id || (access && (await messagingSourceVisibility(db, access, [proposal.source_file_id])).has(proposal.source_file_id));
    if (!access || !sourceVisible || actions.some((action, index) => !visible[index] || !(canReadMessagingReviewAction(access, action) || (proposal.status === "draft" && canWriteMessagingAction(access, action))))) {
      return { ...proposalDto({ ...proposal, source_text: "", clarification: null }, [], { edit: false, confirm: false, cancel: proposal.status === "draft" && Boolean(access) }), title: proposal.status === "completed" ? "Completed request" : proposal.status === "cancelled" ? "Cancelled request" : "Restricted review", summary: "Details are unavailable with your current access." };
    }
    return proposalDto(proposal, actions, access ? proposalCapabilities(access, proposal, actions) : undefined);
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
      const access = await messagingAgentAccess(db).project(identity.user_id, conversation.project_id);
      if (access.project.organization_id !== conversation.organization_id || conversation.paused || identity.revoked_at || identity.opted_out_at) {
        throw new ForbiddenError("Reconnect Messaging to an authorized project before capturing work.");
      }
      const building = await messagingAgentAccess(db).building(access, conversation.building_id);
      const pending = await repo.pendingProposal(conversation.id);
      const previous = pending?.status === "draft"
        ? await repo.actionsForProposal(pending.id, pending.version) : [];
      const scope = { projectId: conversation.project_id, organizationId: conversation.organization_id, buildingId: conversation.building_id,
        projectName: access.project.name, buildingName: building?.name, projectCurrency: access.project.currency, messageSentAt: new Date(inbox.sent_at).toISOString() };
      const discovery = await messagingToolDiscovery(db, access, scope);
      requireMessagingActions(access, previous);
      await requireMessagingReviewTargets(db, access, scope, previous);
      discovery.targets.attachments = await inspectMessagingFiles(db, conversation.id,
        await messagingSourceFiles(db, conversation.id, conversation.scope_version, inbox.id));
      discovery.targets.documentDestinations = documentDestinations(discovery.tools);
      const history = await reads.contextMessages(conversation.id, conversation.scope_version, inbox.id);
      const historyFiles = await messagingSourceVisibility(db, access, history.flatMap((message) => message.source_file_id ? [message.source_file_id] : []));
      const recentMessages: MessagingContextMessage[] = [];
      for (const message of history) {
        if (message.source_file_id && !historyFiles.has(message.source_file_id)) continue;
        const content = message.source_text ?? "";
        if (message.status === "processed" && /^(CONFIRM|CANCEL|STOP|LINK)\b/i.test(content.trim())) break;
        if (!/^(CONFIRM|CANCEL|STOP|LINK|HELP)\b/i.test(content.trim())) recentMessages.unshift({ role: "user", content, sentAt: new Date(message.sent_at).toISOString() });
      }
      if (!pending) {
        const questions = await reads.recentReadSources(conversation.id, conversation.scope_version, inbox.id);
        if (questions.length) {
          const fingerprint = await messagingReadFingerprint(db, access, scope);
          for (const question of questions) if (question.read_access && mayReadAnswer(access, question.read_access, fingerprint)) recentMessages.unshift({ role: "user", content: question.source_text!, sentAt: new Date(question.sent_at).toISOString() });
        }
      }
      if (pending?.source_file_id && !(await messagingSourceVisibility(db, access, [pending.source_file_id])).has(pending.source_file_id)) throw new ForbiddenError("The pending file is no longer accessible. Cancel this review before starting another capture.");
      if (pending?.clarification) recentMessages.push({ role: "assistant", content: pending.clarification });
      let actions: MessagingReviewAction[], clarification: string | null = null;
      let readScope: string | undefined;
      try {
        if (recentMessages.length > 20 || recentMessages.reduce((size, message) => size + message.content.length, text.length) > 40_000) {
          throw new MessagingClarificationError("There is too much pending in this capture. Cancel it and send a smaller batch; your original messages are retained.");
        }
        actions = await draft(text, { ...scope, ...discovery, recentMessages, runRead: async (name, args) => {
          readScope ??= await messagingReadFingerprint(db, access, scope);
          return discovery.runRead(name, args);
        } }, previous.map((action) => ({
          kind: action.kind as MessagingReviewAction["kind"], title: action.title ?? "Field action", payload: action.payload, reviewId: action.id,
        })));
        requireMessagingActions(access, actions);
        await requireCompleteDocumentEvidence(db, conversation.id, actions);
        const summaries = await requireMessagingReviewTargets(db, access, scope, actions);
        actions = actions.map((action, index) => ({ ...action, ...(summaries.has(index) ? { summary: summaries.get(index) } : {}) }));
      } catch (error) {
        if (error instanceof MessagingAnswerResult) {
          const linked = await repo.identityForSender({ channel: identity.channel, channelAccountId: identity.channel_account_id, senderId: identity.sender_id });
          const selected = linked ? await repo.conversation(linked.id) : null;
          if (linked?.id !== identity.id || linked.opted_out_at || selected?.id !== conversation.id || selected.scope_version !== conversation.scope_version || selected.paused) throw new ConflictError("The messaging connection changed during the lookup. Select the current project and ask again.");
          const current = await messagingAgentAccess(db).project(identity.user_id, conversation.project_id);
          const currentScope = await messagingReadFingerprint(db, current, scope);
          const snapshot = { permissions: access.permissions, workspacePermissions: access.workspacePermissions ?? {}, features: access.features.enabled ?? {}, recordScope: readScope };
          if (!readScope || !mayReadAnswer(current, snapshot, currentScope)) throw new ConflictError("Access changed during the lookup. Ask the question again to use current records.");
          await repo.setReadAccess(inbox.id, { permissions: current.permissions, workspacePermissions: current.workspacePermissions ?? {}, features: current.features.enabled ?? {}, recordScope: currentScope });
          return { kind: "answer", answer: error.answer } satisfies MessagingAnswer;
        }
        if (!(error instanceof MessagingClarificationError) && !(error instanceof BadRequestError) && !(error instanceof ValidationError)) throw error;
        clarification = error.message;
        actions = previous.map((action) => ({ kind: action.kind as MessagingReviewAction["kind"], title: action.title ?? "Field action", payload: action.payload }));
      }
      const currentAccess = await messagingAgentAccess(db).project(identity.user_id, conversation.project_id);
      await messagingAgentAccess(db).building(currentAccess, conversation.building_id);
      const currentIdentity = await repo.identityForSender({ channel: identity.channel, channelAccountId: identity.channel_account_id, senderId: identity.sender_id });
      if (currentIdentity?.id !== identity.id || currentIdentity.opted_out_at) {
        throw new ForbiddenError("This Messaging connection is no longer active.");
      }
      const proposal = await repo.createProposal({
        conversationId: conversation.id, inboxId: inbox.id, scopeVersion: conversation.scope_version,
        actions, sourceText: text, sourceKind: inbox.source_kind, sourceFileId: inbox.source_file_id, clarification,
      });
      return dto(proposal, currentAccess);
    },
    async edit(userId: string, projectId: string, id: string, version: number, actions: unknown) {
      const proposal = await owned(userId, projectId, id);
      const access = await messagingAgentAccess(db).project(userId, projectId);
      await messagingAgentAccess(db).building(access, proposal.building_id);
      const scope = { organizationId: proposal.organization_id, projectId: proposal.project_id, buildingId: proposal.building_id };
      const normalized = normalizeReview(actions, scope);
      requireMessagingActions(access, normalized);
      await requireCompleteDocumentEvidence(db, proposal.conversation_id, normalized);
      const summaries = await requireMessagingReviewTargets(db, access, scope, normalized);
      return dto(await repo.updateProposal(id, version, normalized.map((action, index) => ({ ...action, ...(summaries.has(index) ? { summary: summaries.get(index) } : {}) }))), access);
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
        const access = await messagingAgentAccess(trx).project(userId, projectId);
        await messagingAgentAccess(trx).building(access, proposal.building_id);
        if (proposal.version !== version || proposal.scope_version !== conversation.scope_version || proposal.project_id !== projectId) {
          throw new ConflictError("This review or its project changed. Open the latest review before confirming.");
        }
        if (proposal.status === "completed") return proposal;
        if (proposal.status !== "draft") throw new ConflictError("This review is no longer awaiting confirmation.");
        const actions = await store.actionsForProposal(id, version);
        if (proposal.clarification) throw new ConflictError("Answer the missing details before confirming this review.");
        if (!actions.length) throw new ConflictError("This review has no actions.");
        requireMessagingActions(access, actions);
        await requireCompleteDocumentEvidence(trx, proposal.conversation_id, actions);
        const summaries = await requireMessagingReviewTargets(trx, access, { projectId, organizationId: proposal.organization_id, buildingId: proposal.building_id }, actions);
        if (actions.some((action, index) => summaries.has(index) && action.summary !== summaries.get(index))) throw new BadRequestError("The daily-log template changed. Review its current questions and answers before confirming.");
        if (!(await store.finishProposal(id, version, "confirmed"))) throw new ConflictError("This review changed.");
        const scope = { organizationId: proposal.organization_id, projectId: proposal.project_id, buildingId: proposal.building_id };
        for (const action of actions) {
          const actor = { userId, organizationId: scope.organizationId };
          const result = await fieldToolsExecutor(trx, queue).execute({ kind: action.kind, projectId, buildingId: scope.buildingId, payload: action.payload, idempotencyKey: action.id }, actor).catch((error: unknown) => {
            if (error instanceof ConflictError) throw new BadRequestError(error.message);
            throw error;
          });
          if (!(await store.completeAction(action.id, { ...result }))) throw new ConflictError("This action changed.");
        }
        await store.finishProposal(id, version, "completed");
        await store.resetContext(proposal.conversation_id);
        return (await store.proposal(id))!;
      }).catch(async (error: unknown) => {
        if (!(error instanceof BadRequestError) && !(error instanceof ValidationError)) throw error;
        const actions = await repo.actionsForProposal(id, version);
        return repo.updateProposal(id, version, actions.map((action) => ({ kind: action.kind, payload: action.payload, title: action.title ?? undefined, summary: action.summary ?? undefined })), error.message);
      });
      return dto(completed, await messagingAgentAccess(db).project(userId, projectId));
    },
    async cancel(userId: string, projectId: string, id: string, version: number) {
      const proposal = await owned(userId, projectId, id);
      const access = await messagingAgentAccess(db).project(userId, projectId);
      if (proposal.version !== version || !(await repo.finishProposal(id, version, "cancelled"))) {
        throw new ConflictError("This review changed or has already been saved.");
      }
      await repo.resetContext(proposal.conversation_id);
      return dto((await repo.proposal(id))!, access);
    },
  };
}
