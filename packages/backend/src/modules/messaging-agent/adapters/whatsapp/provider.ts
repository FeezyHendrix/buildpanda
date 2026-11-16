import type { WhatsAppProviderConfig } from "./types.ts";
import { z } from "zod";
import { BadRequestError } from "../../../../lib/errors.ts";
import type {
  MessagingDeliveryStatus, MessagingInboundMessage, MessagingMedia,
  MessagingSendInput, MessagingSendResult, MessagingWebhookEvents,
} from "../../types.ts";

const id = z.string().min(1).max(1000);
const timestamp = z.string().regex(/^\d{1,12}$/);
const messageSchema = z.object({
  id, from: id.optional(), from_user_id: id.optional(), timestamp, type: z.string().max(100),
  text: z.object({ body: z.string().max(8000) }).optional(),
  audio: z.object({ id, mime_type: z.string().max(100).optional() }).optional(),
  context: z.object({ id }).optional(),
});
const statusSchema = z.object({ id, recipient_id: id.optional(), recipient_user_id: id.optional(), status: z.string(), timestamp });
const envelopeSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({ changes: z.array(z.object({
    field: z.string(), value: z.object({
      metadata: z.object({ phone_number_id: id }).optional(),
      messages: z.array(messageSchema).max(100).optional(),
      statuses: z.array(statusSchema).max(100).optional(),
    }),
  })).max(100) })).max(100),
});

export function parseWhatsAppWebhook(payload: unknown, phoneNumberId: string): MessagingWebhookEvents {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) throw new BadRequestError("Invalid Messaging webhook payload");
  const messages: MessagingInboundMessage[] = [];
  const statuses: MessagingDeliveryStatus[] = [];
  for (const entry of parsed.data.entry) for (const change of entry.changes) {
    if (change.field !== "messages") continue;
    const value = change.value;
    if (value.metadata?.phone_number_id !== phoneNumberId) {
      throw new BadRequestError("Webhook does not belong to this Messaging business number");
    }
    for (const message of value.messages ?? []) {
      if (messages.length + statuses.length >= 1000) throw new BadRequestError("Messaging event batch is too large");
      const senderId = message.from_user_id ?? message.from;
      const sentAt = new Date(Number(message.timestamp) * 1000);
      if (!senderId || !Number.isFinite(sentAt.getTime())) throw new BadRequestError("Invalid Messaging message identity or timestamp");
      const type = message.type === "text" && message.text ? "text" : message.type === "audio" && message.audio ? "audio" : "unsupported";
      messages.push({
        channel: "whatsapp", channelAccountId: phoneNumberId, senderId, replyRecipientId: senderId, conversationType: "direct", providerMessageId: message.id, sentAt, type,
        text: type === "text" ? message.text!.body : null,
        mediaId: type === "audio" ? message.audio!.id : null,
        mediaMimeType: type === "audio" ? message.audio!.mime_type ?? null : null,
        replyToMessageId: message.context?.id ?? null,
      });
    }
    for (const event of value.statuses ?? []) {
      if (!["sent", "delivered", "read", "failed"].includes(event.status)) continue;
      if (messages.length + statuses.length >= 1000) throw new BadRequestError("Messaging event batch is too large");
      const sentAt = new Date(Number(event.timestamp) * 1000);
      if (!Number.isFinite(sentAt.getTime())) throw new BadRequestError("Invalid Messaging status timestamp");
      statuses.push({
        channel: "whatsapp", channelAccountId: phoneNumberId, providerMessageId: event.id, recipientId: event.recipient_user_id ?? event.recipient_id ?? null,
        status: event.status as MessagingDeliveryStatus["status"], sentAt,
      });
    }
  }
  return { messages, statuses };
}

const audioExtensions: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/aac": "aac", "audio/amr": "amr", "audio/webm": "webm",
};
const mediaSchema = z.object({ url: z.string().url(), mime_type: z.string(), file_size: z.number().int().positive() });
const sentSchema = z.object({ messages: z.array(z.object({ id })).min(1) });

function checkedMediaUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
    !["lookaside.fbsbx.com", "lookaside.facebook.com"].includes(url.hostname)) {
    throw new BadRequestError("Messaging media download URL is not trusted");
  }
  return url;
}

async function boundedBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const length = Number(response.headers.get("content-length"));
  if (length > maxBytes || !response.body) throw new BadRequestError("Messaging media is empty or too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new BadRequestError("Messaging media is too large");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (size === 0) throw new BadRequestError("Messaging media is empty");
  return Buffer.concat(chunks, size);
}

export function whatsappProvider(config: WhatsAppProviderConfig, request: typeof fetch = fetch) {
  const base = config.graphBaseUrl ?? "https://graph.facebook.com";
  if (base !== "https://graph.facebook.com" || !/^v\d+\.\d+$/.test(config.apiVersion) || !/^\d+$/.test(config.phoneNumberId)) {
    throw new BadRequestError("Invalid Messaging Graph API configuration");
  }
  const headers = { Authorization: `Bearer ${config.accessToken}` };
  const timeout = config.timeoutMs ?? 15_000;
  const maxBytes = config.maxMediaBytes ?? 16 * 1024 * 1024;

  return {
    async sendText(input: MessagingSendInput): Promise<MessagingSendResult> {
      if (!/^[A-Za-z0-9_.+-]{1,200}$/.test(input.to) || !input.text.trim() || input.text.length > 4096) {
        throw new BadRequestError("Invalid Messaging recipient or message length");
      }
      let response: Response;
      try {
        response = await request(`${base}/${config.apiVersion}/${config.phoneNumberId}/messages`, {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" }, redirect: "error",
          signal: AbortSignal.timeout(timeout),
          body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: input.to,
            type: "text", text: { body: input.text, preview_url: false },
            ...(input.replyToMessageId ? { context: { message_id: input.replyToMessageId } } : {}),
          }),
        });
      } catch {
        return { status: "unknown", reason: "Provider acceptance could not be established" };
      }
      if (!response.ok) {
        // A server-side failure may occur after acceptance, so it is not safe to resend.
        if (response.status >= 500) return { status: "unknown", reason: "Provider returned an uncertain server error" };
        return { status: "rejected", reason: `Provider rejected message (${response.status})`, retryable: response.status === 429 };
      }
      const sent = sentSchema.safeParse(await response.json().catch(() => null));
      return sent.success ? { status: "accepted", messageId: sent.data.messages[0]!.id }
        : { status: "unknown", reason: "Provider response did not include a message identity" };
    },

    async downloadAudio(mediaId: string): Promise<MessagingMedia> {
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(mediaId)) throw new BadRequestError("Invalid Messaging media identity");
      const response = await request(`${base}/${config.apiVersion}/${encodeURIComponent(mediaId)}?phone_number_id=${config.phoneNumberId}`, {
        headers, redirect: "error", signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok) throw new BadRequestError("Messaging media metadata could not be loaded");
      const parsed = mediaSchema.safeParse(await response.json());
      if (!parsed.success) throw new BadRequestError("Messaging media metadata is invalid");
      const metadata = parsed.data;
      const mimeType = metadata.mime_type.split(";")[0]!.trim().toLowerCase();
      const extension = audioExtensions[mimeType];
      if (!extension || metadata.file_size > maxBytes) throw new BadRequestError("Unsupported or oversized Messaging audio");
      const audio = await request(checkedMediaUrl(metadata.url), { headers, redirect: "error", signal: AbortSignal.timeout(timeout) });
      if (!audio.ok) throw new BadRequestError("Messaging media could not be downloaded");
      const actualType = audio.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (actualType && actualType !== mimeType && actualType !== "application/octet-stream") {
        throw new BadRequestError("Messaging media type does not match its metadata");
      }
      const bytes = await boundedBytes(audio, maxBytes);
      if (bytes.byteLength !== metadata.file_size) throw new BadRequestError("Messaging media size does not match its metadata");
      return { bytes, mimeType, fileName: `voice-note.${extension}` };
    },
  };
}
