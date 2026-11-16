import type { config } from "../../../../config/index.ts";
import type { MessagingChannelAdapter } from "../../channel-types.ts";
import { whatsappProvider } from "./provider.ts";

export function withinWhatsAppServiceWindow(sentAt: Date | string | null, now: Date): boolean {
  if (!sentAt) return false;
  const age = now.getTime() - new Date(sentAt).getTime();
  return Number.isFinite(age) && age >= -5 * 60_000 && age < 24 * 60 * 60_000;
}

export function whatsappChannelAdapter(settings: typeof config.whatsapp, provider = whatsappProvider(settings)): MessagingChannelAdapter {
  return {
    channel: "whatsapp", channelAccountId: settings.phoneNumberId, label: "WhatsApp", maxTextLength: 4096, maxButtonTextLength: 1024,
    connectUrl: (code) => `https://wa.me/${settings.businessNumber.replace(/^\+/, "")}?text=${encodeURIComponent(`LINK ${code}`)}`,
    canReply: withinWhatsAppServiceWindow,
    sendText: provider.sendText,
    downloadAudio: provider.downloadAudio,
  };
}
