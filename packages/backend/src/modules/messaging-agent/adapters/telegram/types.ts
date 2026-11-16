import type { MessagingWebhookEvents } from "../../types.ts";

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  botId: string;
  botUsername: string;
  webhookSecret: string;
}

export interface TelegramProviderConfig {
  botToken: string;
  botId: string;
  timeoutMs?: number;
  maxMediaBytes?: number;
}

export interface TelegramWebhookOptions {
  settings?: TelegramConfig;
  answerCallbackQuery?: (id: string) => Promise<void>;
}

export interface TelegramWebhookEvents extends MessagingWebhookEvents {
  callbackQueryId?: string;
}

export interface TelegramSender {
  chatId: number;
  userId: number;
}

export interface TelegramMessageIdentity {
  chatId: number;
  messageId: number;
}

export interface TelegramAudioFormat {
  mimeType: string;
  extension: string;
}

export interface TelegramMediaIdentity {
  fileId: string;
  mimeType?: string;
  extension?: string;
}
