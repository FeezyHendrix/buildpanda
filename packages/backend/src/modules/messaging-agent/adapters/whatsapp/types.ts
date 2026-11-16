import type { config } from "../../../../config/index.ts";

export interface WhatsAppProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  graphBaseUrl?: string;
  timeoutMs?: number;
  maxMediaBytes?: number;
}

export interface WhatsAppWebhookOptions {
  settings?: typeof config.whatsapp;
}

export interface WhatsAppVerificationQuery {
  "hub.mode": string;
  "hub.verify_token": string;
  "hub.challenge": string;
}
