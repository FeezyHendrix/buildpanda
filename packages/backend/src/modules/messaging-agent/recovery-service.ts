import type { Knex } from "knex";
import { ConflictError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import type { MessagingAdapterRegistry } from "./channel-types.ts";
import { messagingAgentAccess } from "./access.ts";
import { messagingAgentRecoveryRepository } from "./recovery-repository.ts";
import { messagingAgentReadRepository } from "./read-repository.ts";
import { messagingAgentRepository } from "./repository.ts";

export function messagingAgentRecoveryService(db: Knex, adapters: MessagingAdapterRegistry) {
  return {
    async retry(userId: string, projectId: string, messageId: string) {
      return db.transaction(async (trx) => {
        const access = await messagingAgentAccess(trx).project(userId, projectId);
        const row = await messagingAgentRecoveryRepository(trx).ownMessage(userId, projectId, messageId);
        if (!row) throw new NotFoundError("Messaging message");
        const repo = messagingAgentRepository(trx);
        // Match worker lock order so retry cannot cross a concurrent unlink/scope switch.
        const identity = await messagingAgentReadRepository(trx).lockIdentity(row.identity.id);
        const conversation = await repo.lockConversation(row.conversation.id);
        if (!identity || !conversation || identity.user_id !== userId || identity.revoked_at || identity.opted_out_at || conversation.paused ||
          identity.channel !== row.channel || identity.channel_account_id !== row.channel_account_id || row.conversation_type !== "direct" ||
          identity.sender_id !== row.sender_id || row.identity_id !== conversation.identity_id || row.conversation_id !== conversation.id ||
          row.scope_version !== conversation.scope_version || row.project_id !== conversation.project_id || row.building_id !== conversation.building_id ||
          row.organization_id !== conversation.organization_id || row.organization_id !== access.project.organization_id) {
          throw new ForbiddenError("This message belongs to an inactive connection or a previous project selection.");
        }
        adapters.get(row.channel, row.channel_account_id);
        await messagingAgentAccess(trx).building(access, conversation.building_id);
        if (row.origin === "web") throw new ConflictError("Retry app drafts by sending the text again in the composer.");
        if (row.status === "processed") throw new ConflictError("This message has already been processed.");
        if (row.status === "failed") await repo.retryInbox(row.id);
        const current = await repo.inbox(row.id);
        if (!current || !["received", "processing"].includes(current.status)) throw new ConflictError("This message is no longer available for retry.");
        return { messageId: row.id, status: current.status as "received" | "processing" };
      });
    },
  };
}
