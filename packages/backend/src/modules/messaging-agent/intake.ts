import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import { messagingAgentRepository } from "./repository.ts";
import type { MessagingChannelAccount, MessagingWebhookEvents } from "./types.ts";

export function messagingAgentIntake(db: Knex) {
  return {
    async receive(account: MessagingChannelAccount, events: MessagingWebhookEvents, now = new Date()) {
      if (events.messages.length + events.statuses.length > 1000 || [...events.messages, ...events.statuses].some((event) =>
        event.channel !== account.channel || event.channelAccountId !== account.channelAccountId)) {
        throw new BadRequestError("Events must belong to the verified messaging account.");
      }
      if (events.messages.some((message) => message.origin === "web" || !Number.isFinite(message.sentAt.getTime()))) {
        throw new BadRequestError("Invalid provider message origin or timestamp.");
      }
      await db.transaction(async (trx) => {
        const repo = messagingAgentRepository(trx);
        for (const message of events.messages) {
          const inbox = await repo.acceptMessage(message);
          if (inbox?.identity_id && inbox.conversation_type === "direct") {
            await repo.touchIdentity(inbox.identity_id, new Date(Math.min(message.sentAt.getTime(), now.getTime())));
          }
        }
        for (const status of events.statuses) await repo.markDelivery(status);
      });
    },
  };
}
