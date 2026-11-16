import { BadRequestError, ServiceUnavailableError } from "../../lib/errors.ts";
import type { MessagingAdapterRegistry, MessagingChannelAdapter } from "./channel-types.ts";

export function messagingAdapterRegistry(adapters: readonly MessagingChannelAdapter[]): MessagingAdapterRegistry {
  const entries = new Map<string, MessagingChannelAdapter>();
  const key = (channel: string, accountId: string) => JSON.stringify([channel, accountId]);
  for (const adapter of adapters) {
    if (!/^[a-z][a-z0-9-]{0,49}$/.test(adapter.channel) || !adapter.channelAccountId || adapter.channelAccountId.length > 200 ||
      !Number.isInteger(adapter.maxTextLength) || adapter.maxTextLength < 1 || entries.has(key(adapter.channel, adapter.channelAccountId))) {
      throw new BadRequestError("Invalid or duplicate messaging channel configuration.");
    }
    entries.set(key(adapter.channel, adapter.channelAccountId), adapter);
  }
  return {
    list: () => [...entries.values()],
    find: (channel, accountId) => entries.get(key(channel, accountId)),
    get(channel, accountId) {
      const adapter = entries.get(key(channel, accountId));
      if (!adapter) throw new ServiceUnavailableError("This messaging channel is not configured.", "messaging_channel_unavailable");
      return adapter;
    },
  };
}
