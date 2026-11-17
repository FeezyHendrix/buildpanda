import type { MessagingChannelAdapter } from "../../channel-types.ts";
import { telegramProvider } from "./provider.ts";
import type { TelegramConfig } from "./types.ts";

export function telegramChannelAdapter(settings: TelegramConfig, provider: Pick<MessagingChannelAdapter, "sendText" | "downloadAudio" | "downloadAttachment"> = telegramProvider(settings)): MessagingChannelAdapter {
  return {
    channel: "telegram", channelAccountId: settings.botId, label: "Telegram", maxTextLength: 4096,
    connectUrl: (code) => `https://t.me/${settings.botUsername.replace(/^@/, "")}?start=${encodeURIComponent(code)}`,
    canReply(lastInboundAt, now) {
      if (!lastInboundAt) return false;
      const sentAt = new Date(lastInboundAt).getTime();
      return Number.isFinite(sentAt) && sentAt <= now.getTime() + 5 * 60_000;
    },
    sendText: provider.sendText,
    downloadAudio: provider.downloadAudio,
    downloadAttachment: provider.downloadAttachment,
  };
}
