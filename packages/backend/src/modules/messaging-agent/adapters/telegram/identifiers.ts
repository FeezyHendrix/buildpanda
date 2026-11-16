import { createHash } from "node:crypto";
import { BadRequestError } from "../../../../lib/errors.ts";
import type { TelegramAudioFormat, TelegramMediaIdentity, TelegramMessageIdentity, TelegramSender } from "./types.ts";

const audioExtensions: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav",
  "audio/x-wav": "xwav", "audio/aac": "aac", "audio/amr": "amr", "audio/webm": "webm",
};

function positiveId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestError("Invalid Telegram identity");
  return value;
}

export function telegramSenderId(chatId: number, userId: number): string {
  if (positiveId(chatId) !== positiveId(userId)) throw new BadRequestError("Telegram requires a private user chat");
  return `tg:${chatId}:${userId}`;
}

export function parseTelegramSenderId(value: string): TelegramSender {
  const parts = /^tg:([1-9]\d{0,15}):([1-9]\d{0,15})$/.exec(value);
  if (!parts) throw new BadRequestError("Invalid Telegram recipient identity");
  const chatId = Number(parts[1]), userId = Number(parts[2]);
  telegramSenderId(chatId, userId);
  return { chatId, userId };
}

export function telegramMessageId(chatId: number, messageId: number): string {
  return `tg:${positiveId(chatId)}:${positiveId(messageId)}`;
}

export function telegramCallbackMessageId(chatId: number, messageId: number, callbackId: string): string {
  return `${telegramMessageId(chatId, messageId)}:callback:${createHash("sha256").update(callbackId).digest("hex")}`;
}

export function parseTelegramMessageId(value: string): TelegramMessageIdentity {
  const parts = /^tg:([1-9]\d{0,15}):([1-9]\d{0,15})(?::callback:[a-f0-9]{64})?$/.exec(value);
  if (!parts) throw new BadRequestError("Invalid Telegram message identity");
  return { chatId: positiveId(Number(parts[1])), messageId: positiveId(Number(parts[2])) };
}

export function telegramAudioFormat(value: string): TelegramAudioFormat | undefined {
  const mimeType = value.split(";")[0]!.trim().toLowerCase();
  const extension = Object.hasOwn(audioExtensions, mimeType) ? audioExtensions[mimeType] : undefined;
  return extension ? { mimeType, extension: extension === "xwav" ? "wav" : extension } : undefined;
}

export function telegramMediaId(fileId: string, mimeType?: string): string {
  const format = mimeType === undefined ? undefined : telegramAudioFormat(mimeType);
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(fileId) || (mimeType !== undefined && !format)) throw new BadRequestError("Unsupported Telegram audio identity");
  return `tg:${format ? audioExtensions[format.mimeType] : "audio"}:${fileId}`;
}

export function parseTelegramMediaId(value: string): TelegramMediaIdentity {
  const parts = /^tg:([a-z0-9]+):([A-Za-z0-9_-]{1,512})$/.exec(value);
  const mimeType = Object.keys(audioExtensions).find((mime) => audioExtensions[mime] === parts?.[1]);
  if (!parts || (!mimeType && parts[1] !== "audio")) throw new BadRequestError("Invalid Telegram audio identity");
  return { fileId: parts[2]!, ...(mimeType ? telegramAudioFormat(mimeType) : {}) };
}
