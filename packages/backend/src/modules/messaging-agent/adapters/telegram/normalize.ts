import { z } from "zod";
import { BadRequestError } from "../../../../lib/errors.ts";
import { attachmentMediaId, attachmentMime } from "../../attachment-media.ts";
import { isReviewCommand } from "../../reply-buttons.ts";
import { telegramAudioFormat, telegramCallbackMessageId, telegramMediaId, telegramMessageId, telegramSenderId } from "./identifiers.ts";
import type { TelegramConfig, TelegramWebhookEvents } from "./types.ts";

const positiveId = z.number().int().positive().safe();
const audioSchema = z.object({
  file_id: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/),
  mime_type: z.string().max(100).optional(),
});
const attachmentSchema = z.object({
  file_id: z.string().regex(/^[A-Za-z0-9_-]{1,512}$/), mime_type: z.string().max(100).optional(),
  file_name: z.string().min(1).max(255).optional(), file_size: positiveId.optional(),
});
const photoSchema = attachmentSchema.extend({ width: positiveId, height: positiveId });
const messageSchema = z.object({
  message_id: positiveId, date: z.number().int().nonnegative().safe(),
  chat: z.object({ id: z.number().int().safe(), type: z.enum(["private", "group", "supergroup", "channel"]) }),
  from: z.object({ id: positiveId, is_bot: z.boolean() }).optional(),
  sender_chat: z.unknown().optional(), business_connection_id: z.string().optional(),
  message_thread_id: z.number().int().safe().optional(), direct_messages_topic: z.unknown().optional(), is_topic_message: z.boolean().optional(),
  caption: z.string().max(8000).optional(), photo: z.array(photoSchema).min(1).max(20).optional(),
  document: attachmentSchema.optional(), video: attachmentSchema.optional(),
  text: z.string().max(8000).optional(), voice: audioSchema.optional(), audio: audioSchema.optional(),
  reply_to_message: z.object({ message_id: positiveId }).optional(),
});
const callbackSchema = z.object({
  id: z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/),
  from: z.object({ id: positiveId, is_bot: z.boolean() }),
  message: messageSchema.optional(), data: z.unknown().optional(),
  inline_message_id: z.unknown().optional(), game_short_name: z.unknown().optional(),
});
const updateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(), message: messageSchema.optional(), callback_query: callbackSchema.optional(),
});

function commandText(text: string, username: string): string | null {
  const command = /^\/([A-Za-z0-9_]{1,32})(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!command) return text;
  if (command[2] && command[2].toLowerCase() !== username.replace(/^@/, "").toLowerCase()) return null;
  const name = command[1]!.toUpperCase(), argument = command[3]?.trim() ?? "";
  if (name === "START") return /^[A-Za-z0-9_-]{24,128}$/.test(argument) ? `LINK ${argument}` : "HELP";
  if (["LINK", "HELP", "STOP", "CONFIRM", "CANCEL"].includes(name)) return `${name}${argument ? ` ${argument}` : ""}`;
  return text;
}

export function parseTelegramUpdate(payload: unknown, settings: TelegramConfig, now = new Date()): TelegramWebhookEvents {
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) throw new BadRequestError("Invalid Telegram update payload");
  const callback = parsed.data.callback_query;
  if (callback) {
    const message = callback.message;
    if (parsed.data.message || !message || callback.inline_message_id !== undefined || callback.game_short_name !== undefined ||
      !isReviewCommand(callback.data) || callback.from.is_bot || message.chat.type !== "private" || message.chat.id !== callback.from.id ||
      message.from?.is_bot !== true || String(message.from.id) !== settings.botId || message.sender_chat !== undefined ||
      message.business_connection_id !== undefined || message.message_thread_id !== undefined || message.direct_messages_topic !== undefined || message.is_topic_message) {
      return { messages: [], statuses: [] };
    }
    if (!Number.isFinite(now.getTime())) throw new BadRequestError("Invalid Telegram callback timestamp");
    const senderId = telegramSenderId(message.chat.id, callback.from.id);
    return { messages: [{
      channel: "telegram", channelAccountId: settings.botId, senderId, replyRecipientId: senderId, conversationType: "direct",
      providerMessageId: telegramCallbackMessageId(message.chat.id, message.message_id, callback.id), sentAt: new Date(now.getTime()),
      type: "text", text: callback.data, mediaId: null, mediaMimeType: null,
      replyToMessageId: telegramMessageId(message.chat.id, message.message_id),
    }], statuses: [], callbackQueryId: callback.id };
  }
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
  const photo = message.photo?.reduce((best, next) => next.width * next.height > best.width * best.height ? next : best);
  const attachment = message.document ?? message.video ?? photo;
  const attachmentType = photo === attachment ? "image/jpeg" : attachmentMime(attachment?.mime_type);
  const type = text !== null ? "text" : attachment ? "attachment" : supportedAudio ? "audio" : "unsupported";
  return { messages: [{
    channel: "telegram", channelAccountId: settings.botId, senderId, replyRecipientId: senderId,
    conversationType: "direct", providerMessageId: telegramMessageId(message.chat.id, message.message_id), sentAt, type,
    text: type === "attachment" ? message.caption ?? null : text,
    mediaId: type === "audio" ? telegramMediaId(audio!.file_id, mimeType) : type === "attachment" ? attachmentMediaId("telegram", {
      providerId: attachment!.file_id, fileName: attachment!.file_name ?? (photo === attachment ? "photo.jpg" : message.video ? "video.mp4" : "attachment"),
      ...(attachmentType ? { mimeType: attachmentType } : {}), ...(attachment!.file_size ? { sizeBytes: attachment!.file_size } : {}),
    }) : null,
    mediaMimeType: type === "audio" ? mimeType ?? null : type === "attachment" ? attachmentType ?? null : null,
    replyToMessageId: message.reply_to_message ? telegramMessageId(message.chat.id, message.reply_to_message.message_id) : null,
  }], statuses: [] };
}
