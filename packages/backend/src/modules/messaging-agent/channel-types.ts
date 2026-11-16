import type { MessagingMedia, MessagingSendInput, MessagingSendResult } from "./types.ts";

export interface MessagingChannelAdapter {
  channel: string;
  channelAccountId: string;
  label: string;
  maxTextLength: number;
  connectUrl(code: string): string | null;
  canReply(lastInboundAt: Date | string | null, now: Date): boolean;
  sendText(input: MessagingSendInput): Promise<MessagingSendResult>;
  downloadAudio(mediaId: string): Promise<MessagingMedia>;
}

export interface MessagingAdapterRegistry {
  list(): readonly MessagingChannelAdapter[];
  find(channel: string, accountId: string): MessagingChannelAdapter | undefined;
  get(channel: string, accountId: string): MessagingChannelAdapter;
}
