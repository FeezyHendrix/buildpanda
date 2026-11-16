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
