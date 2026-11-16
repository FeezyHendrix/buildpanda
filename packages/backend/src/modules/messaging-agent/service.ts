import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Knex } from "knex";
import type { QueueManager } from "../../lib/queue/index.ts";
import { messagingHistory } from "./history.ts";
import { ConflictError, NotFoundError, ServiceUnavailableError, isAppError } from "../../lib/errors.ts";
import { buildingsRepository } from "../buildings/repository.ts";
import { messagingAgentAccess } from "./access.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAgentReviewService } from "./review-service.ts";
import { messagingToolDiscovery } from "./tool-discovery.ts";
import { messagingReviewVisibility } from "./review-access.ts";
import { messagingReadFingerprint } from "./read-access.ts";
import type { MessagingAdapterRegistry } from "./channel-types.ts";
import type { MessagingConnectionRow, MessagingLinkInput, MessagingScopeInput } from "./management-types.ts";

export function linkCodeHash(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function requireMessagingEnabled(adapters: MessagingAdapterRegistry): void {
  if (!adapters.list().length) throw new ServiceUnavailableError("No messaging channel is configured.", "messaging_agent_disabled");
}

export function messagingAgentService(db: Knex, adapters: MessagingAdapterRegistry, queue?: QueueManager) {
  const repo = messagingAgentRepository(db), reads = messagingAgentReadRepository(db), access = messagingAgentAccess(db);
  const review = messagingAgentReviewService(db, undefined, queue);

  async function connection(userId: string, connectionId: string) {
    const linked = await reads.connection(userId, connectionId);
    if (!linked) throw new NotFoundError("Messaging connection");
    adapters.get(linked.channel, linked.channel_account_id);
    return linked;
  }

  async function selectedScope(userId: string, linked: MessagingConnectionRow) {
    if (linked.opted_out_at || linked.conversation.paused) return null;
    try {
      const context = await access.project(userId, linked.conversation.project_id);
      if (context.project.organization_id !== linked.conversation.organization_id) return null;
      const building = await access.building(context, linked.conversation.building_id);
      return { projectId: context.project.id, buildingId: building?.id ?? null };
    } catch (error) {
      if (isAppError(error) && [400, 403, 404].includes(error.statusCode)) return null;
      throw error;
    }
  }

  async function authorizeProposal(userId: string, projectId: string, proposalId: string) {
    await access.project(userId, projectId);
    const owned = await reads.ownedProposal(userId, projectId, proposalId);
    if (!owned) throw new NotFoundError("Messaging review");
    adapters.get(owned.channel, owned.channel_account_id);
  }

  return {
    async tools(userId: string, projectId: string, connectionId?: string) {
      const context = await access.project(userId, projectId);
      const linked = connectionId ? await connection(userId, connectionId) : undefined;
      if (linked && (linked.conversation.project_id !== projectId || linked.conversation.organization_id !== context.project.organization_id || linked.opted_out_at || linked.conversation.paused)) throw new ConflictError("Select an active connection on this project.");
      const scope = { projectId, organizationId: context.project.organization_id, buildingId: linked?.conversation.building_id ?? null };
      const { tools, targets, uploads } = await messagingToolDiscovery(db, context, scope);
      return { tools, targets, uploads };
    },
    async status(userId: string) {
      const projects = await access.projects(userId);
      const linked = (await reads.connections(userId)).filter((row) => adapters.find(row.channel, row.channel_account_id));
      return {
        userId, enabled: adapters.list().length > 0, projects,
        channels: adapters.list().map((adapter) => ({ id: adapter.channel, accountId: adapter.channelAccountId, label: adapter.label, enabled: true })),
        connections: await Promise.all(linked.map(async (row) => ({
          id: row.id, channel: row.channel, accountId: row.channel_account_id,
          channelLabel: adapters.get(row.channel, row.channel_account_id).label,
          linkedAt: new Date(row.created_at).toISOString(), selectedScope: await selectedScope(userId, row),
        }))),
      };
    },
    async link(userId: string, input: MessagingLinkInput) {
      const adapter = adapters.get(input.channel, input.accountId);
      const context = await access.project(userId, input.projectId);
      const building = await access.building(context, input.buildingId);
      const code = randomBytes(24).toString("base64url"), expiresAt = new Date(Date.now() + 10 * 60_000);
      await repo.createLinkCode({
        channel: adapter.channel, channelAccountId: adapter.channelAccountId, userId,
        organizationId: context.project.organization_id, projectId: context.project.id,
        buildingId: building?.id ?? null, codeHash: linkCodeHash(code), expiresAt,
      });
      return { code, expiresAt: expiresAt.toISOString(), connectUrl: adapter.connectUrl(code) };
    },
    async unlink(userId: string, connectionId: string) {
      await access.actor(userId);
      if (!(await reads.connection(userId, connectionId))) throw new NotFoundError("Messaging connection");
      await repo.revokeIdentity(connectionId, userId);
    },
    async session(userId: string, projectId: string, connectionId?: string) {
      const context = await access.project(userId, projectId);
      const buildings = (context.permissions.buildings ?? []).includes("view") ? await buildingsRepository(db).listByProject(projectId) : [];
      const stored = connectionId ? await connection(userId, connectionId) : undefined;
      const linked = stored && !stored.opted_out_at && !stored.conversation.paused && stored.conversation.project_id === projectId &&
        stored.conversation.organization_id === context.project.organization_id && (stored.conversation.building_id === null || buildings.some((building) => building.id === stored.conversation.building_id)) ? stored : undefined;
      const buildingId = linked?.conversation.building_id ?? (!stored && buildings.length === 1 ? buildings[0]!.id : null);
      const canReadHistory = context.capabilities.read;
      const proposals = linked ? await reads.proposals(userId, projectId, buildingId, true, linked.id) : [];
      const [inbox, outbox] = linked && canReadHistory ? await Promise.all([
        reads.messages(linked.id, projectId, linked.conversation.building_id), reads.replies(linked.conversation.id, linked.conversation.scope_version),
      ]) : [[], []];
      const actions = await reads.actionsForProposals(proposals.map((proposal) => proposal.id));
      const visible = await messagingReviewVisibility(db, context, { projectId, organizationId: context.project.organization_id, buildingId }, actions);
      const recordScope = inbox.some((source) => source.read_access?.recordScope) ? await messagingReadFingerprint(db, context, { projectId, organizationId: context.project.organization_id, buildingId }) : undefined;
      return {
        connectionId: stored?.id ?? null, projectId, organizationId: context.project.organization_id, buildingId, permissions: context.permissions,
        buildings: buildings.map(({ id, name }) => ({ id, name })),
        capabilities: context.capabilities,
        ...messagingHistory(context, proposals, actions, inbox, outbox, new Set(actions.filter((_, index) => visible[index]).map((action) => action.id)), recordScope),
      };
    },
    async setScope(userId: string, input: MessagingScopeInput) {
      const context = await access.project(userId, input.projectId), building = await access.building(context, input.buildingId);
      const linked = await connection(userId, input.connectionId);
      if (linked.opted_out_at) throw new ConflictError("Reconnect this messaging account before changing its scope.");
      await repo.setScope(linked.conversation.id, { organizationId: context.project.organization_id, projectId: input.projectId, buildingId: building?.id ?? null });
    },
    async propose(userId: string, projectId: string, connectionId: string, text: string) {
      await access.project(userId, projectId);
      const linked = await connection(userId, connectionId);
      if (linked.conversation.project_id !== projectId) throw new ConflictError("Select this project on the messaging connection first.");
      const inbox = await repo.acceptMessage({
        channel: linked.channel, channelAccountId: linked.channel_account_id, senderId: linked.sender_id,
        replyRecipientId: linked.sender_id, conversationType: "direct", origin: "web", providerMessageId: randomUUID(), type: "text", text, sentAt: new Date(),
        mediaId: null, mediaMimeType: null, replyToMessageId: null,
      });
      if (!inbox) throw new ConflictError("This request has already been received.");
      await repo.claimInbox(inbox.id);
      try {
        const result = await review.draft(inbox, linked, linked.conversation, text);
        if ("kind" in result && result.kind === "answer") {
          const saved = await repo.enqueueOutbox({ inboxId: inbox.id, identityId: linked.id, conversationId: linked.conversation.id, scopeVersion: linked.conversation.scope_version, body: result.answer, recipientId: inbox.reply_recipient_id, idempotencyKey: `${inbox.id}:answer` });
          await repo.acknowledgeWebReply(saved.id);
        }
        await repo.completeInbox(inbox.id); return result;
      } catch (error) {
        await repo.failInbox(inbox.id, error instanceof Error ? error.message : "Draft failed"); throw error;
      }
    },
    async edit(userId: string, projectId: string, id: string, version: number, actions: unknown) {
      await authorizeProposal(userId, projectId, id); return review.edit(userId, projectId, id, version, actions);
    },
    async confirm(userId: string, projectId: string, id: string, version: number) {
      await authorizeProposal(userId, projectId, id); return review.confirm(userId, projectId, id, version);
    },
    async cancel(userId: string, projectId: string, id: string, version: number) {
      await authorizeProposal(userId, projectId, id); return review.cancel(userId, projectId, id, version);
    },
  };
}
