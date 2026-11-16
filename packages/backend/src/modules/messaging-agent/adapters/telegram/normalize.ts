import { z } from "zod";
import { BadRequestError } from "../../../../lib/errors.ts";
import type { MessagingWebhookEvents } from "../../types.ts";
import { telegramAudioFormat, telegramMediaId, telegramMessageId, telegramSenderId } from "./identifiers.ts";
import type { TelegramConfig } from "./types.ts";

const positiveId = z.number().int().positive().safe();
const audioSchema = z.object({
  file_id: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/),
  mime_type: z.string().max(100).optional(),
});
const messageSchema = z.object({
  message_id: positiveId, date: z.number().int().nonnegative().safe(),
  chat: z.object({ id: z.number().int().safe(), type: z.enum(["private", "group", "supergroup", "channel"]) }),
  from: z.object({ id: positiveId, is_bot: z.boolean() }).optional(),
  sender_chat: z.unknown().optional(), business_connection_id: z.string().optional(),
  message_thread_id: z.number().int().safe().optional(), direct_messages_topic: z.unknown().optional(), is_topic_message: z.boolean().optional(),
  text: z.string().max(8000).optional(), voice: audioSchema.optional(), audio: audioSchema.optional(),
  reply_to_message: z.object({ message_id: positiveId }).optional(),
});
const updateSchema = z.object({ update_id: z.number().int().nonnegative().safe(), message: messageSchema.optional() });

function commandText(text: string, username: string): string | null {
  const command = /^\/([A-Za-z0-9_]{1,32})(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!command) return text;
  if (command[2] && command[2].toLowerCase() !== username.replace(/^@/, "").toLowerCase()) return null;
  const name = command[1]!.toUpperCase(), argument = command[3]?.trim() ?? "";
  if (name === "START") return /^[A-Za-z0-9_-]{24,128}$/.test(argument) ? `LINK ${argument}` : "HELP";
  if (["LINK", "HELP", "STOP", "CONFIRM", "CANCEL"].includes(name)) return `${name}${argument ? ` ${argument}` : ""}`;
  return text;
}

export function parseTelegramUpdate(payload: unknown, settings: TelegramConfig): MessagingWebhookEvents {
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) throw new BadRequestError("Invalid Telegram update payload");
  const message = parsed.data.message;
  // The shared conversation has no topic address; accept only ordinary private user messages.
  if (!message || message.chat.type !== "private" || message.from?.is_bot || message.sender_chat !== undefined || message.business_connection_id !== undefined ||
    message.message_thread_id !== undefined || message.direct_messages_topic !== undefined || message.is_topic_message) {
    return { messages: [], statuses: [] };
  }
  if (!message.from) throw new BadRequestError("Invalid Telegram message sender");
  const sentAt = new Date(message.date * 1000);
  if (!Number.isFinite(sentAt.getTime())) throw new BadRequestError("Invalid Telegram message timestamp");
  const senderId = telegramSenderId(message.chat.id, message.from.id);
  const text = message.text === undefined ? null : commandText(message.text, settings.botUsername);
  if (message.text !== undefined && text === null) return { messages: [], statuses: [] };
  const audio = message.voice ?? message.audio;
  const mimeType = audio?.mime_type ? telegramAudioFormat(audio.mime_type)?.mimeType : undefined;
  const supportedAudio = audio && (audio.mime_type === undefined || mimeType !== undefined);
  const type = text !== null ? "text" : supportedAudio ? "audio" : "unsupported";
  return { messages: [{
    channel: "telegram", channelAccountId: settings.botId, senderId, replyRecipientId: senderId,
    conversationType: "direct", providerMessageId: telegramMessageId(message.chat.id, message.message_id), sentAt, type,
    text, mediaId: type === "audio" ? telegramMediaId(audio!.file_id, mimeType) : null,
    mediaMimeType: type === "audio" ? mimeType ?? null : null,
    replyToMessageId: message.reply_to_message ? telegramMessageId(message.chat.id, message.reply_to_message.message_id) : null,
  }], statuses: [] };
}
