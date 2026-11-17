import type { Knex } from "knex";
import type { MessagingRecoverableMessageRow } from "./types.ts";

export function messagingAgentRecoveryRepository(db: Knex) {
  return {
    ownMessage: (userId: string, projectId: string, messageId: string) => db("messaging_agent_inbox as m")
      .join("messaging_agent_identity_links as i", "i.id", "m.identity_id")
      .join("messaging_agent_conversations as c", "c.id", "m.conversation_id")
      .where({ "m.id": messageId, "m.project_id": projectId, "i.user_id": userId })
      .select<MessagingRecoverableMessageRow[]>("m.*", db.raw("row_to_json(i) as identity"), db.raw("row_to_json(c) as conversation")).first(),
  };
}
