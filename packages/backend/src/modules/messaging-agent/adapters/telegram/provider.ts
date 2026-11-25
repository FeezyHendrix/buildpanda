import { config } from "../../../../config/index.ts";
import { parseAttachmentMediaId, boundedAttachmentBytes, attachmentMime } from "../../attachment-media.ts";
import { z } from "zod";
import { BadRequestError } from "../../../../lib/errors.ts";
import { MESSAGING_CHANNEL, type MessagingMedia, type MessagingSendInput, type MessagingSendResult } from "../../types.ts";
import { validReviewButtons } from "../../reply-buttons.ts";
import { parseTelegramMediaId, parseTelegramMessageId, parseTelegramSenderId, telegramAudioFormat, telegramMessageId } from "./identifiers.ts";
import type { TelegramProviderConfig } from "./types.ts";

const positiveId = z.number().int().positive().safe();
const sentSchema = z.object({ ok: z.literal(true), result: z.object({
  message_id: positiveId, chat: z.object({ id: positiveId, type: z.literal("private") }),
}) });
const rejectedSchema = z.object({ ok: z.literal(false), error_code: z.number().int().min(400).max(499) });
const fileSchema = z.object({ ok: z.literal(true), result: z.object({
  file_id: z.string().min(1).max(512), file_path: z.string().min(1).max(1024), file_size: positiveId.optional(),
}) });
const maxDownloadBytes = 20 * 1024 * 1024;
const audioPathMime: Record<string, string> = {
  ogg: "audio/ogg", oga: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4",
  wav: "audio/wav", aac: "audio/aac", amr: "audio/amr", webm: "audio/webm",
};

function mediaUrl(token: string, path: string): URL {
  if (!path.split("/").every((part) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part))) {
    throw new BadRequestError("Telegram audio path is invalid");
  }
  return new URL(`https://api.telegram.org/file/bot${token}/${path}`);
}

async function boundedBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const length = response.headers.get("content-length");
  if ((length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new BadRequestError("Telegram audio is empty or too large");
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new BadRequestError("Telegram audio is too large");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (!size) throw new BadRequestError("Telegram audio is empty");
  return Buffer.concat(chunks, size);
}

const retryDelaysMs = [500, 2_000];

/** Retries network errors, timeouts, 429 and 5xx; a thrown fetch error can contain the bot token, so it is never kept. */
async function fetchWithRetry(request: typeof fetch, url: string | URL, init: () => RequestInit, failure: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try { response = await request(url, init()); } catch { response = undefined; }
    if (response && response.status < 500 && response.status !== 429) return response;
    await response?.body?.cancel().catch(() => undefined);
    if (attempt >= retryDelaysMs.length) throw new BadRequestError(failure);
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
  }
}

export function telegramProvider(settings: TelegramProviderConfig, request: typeof fetch = fetch) {
  const botToken = settings.botToken;
  const token = /^([1-9]\d{0,15}):[A-Za-z0-9_-]{20,200}$/.exec(botToken);
  const timeout = settings.timeoutMs ?? 15_000, maxBytes = settings.maxMediaBytes ?? maxDownloadBytes;
  if (!token || token[1] !== settings.botId || !Number.isSafeInteger(Number(settings.botId)) ||
    !Number.isSafeInteger(timeout) || timeout <= 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > maxDownloadBytes) {
    throw new BadRequestError("Telegram provider configuration is invalid");
  }
  const base = `https://api.telegram.org/bot${botToken}`;

  return {
    async sendText(input: MessagingSendInput): Promise<MessagingSendResult> {
      let chatId: number, replyId: number | undefined;
      try {
        chatId = parseTelegramSenderId(input.to).chatId;
        if (!input.text.length || input.text.length > 4096) throw new Error("invalid text");
        if (input.buttons !== undefined && !validReviewButtons(input.buttons)) throw new Error("invalid buttons");
        if (input.replyToMessageId) {
          const reply = parseTelegramMessageId(input.replyToMessageId);
          if (reply.chatId !== chatId) throw new Error("foreign reply");
          replyId = reply.messageId;
        }
      } catch {
        return { status: "rejected", reason: "Telegram recipient, text, reply or buttons are invalid", retryable: false };
      }
      try {
        const response = await request(`${base}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error", signal: AbortSignal.timeout(timeout),
          body: JSON.stringify({ chat_id: chatId, text: input.text,
            ...(replyId ? { reply_parameters: { message_id: replyId, allow_sending_without_reply: true } } : {}),
            ...(input.buttons ? { reply_markup: { inline_keyboard: [input.buttons.map((button) => ({ text: button.label, callback_data: button.command }))] } } : {}),
          }),
        });
        if (response.status >= 500) return { status: "unknown", reason: "Telegram server failed before confirming delivery" };
        if (response.status >= 400 && response.status < 500) {
          return { status: "rejected", reason: `Telegram rejected message (${response.status})`, retryable: response.status === 429 };
        }
        if (!response.ok) return { status: "unknown", reason: "Telegram did not confirm delivery" };
        const payload: unknown = await response.json().catch(() => null);
        const rejection = rejectedSchema.safeParse(payload);
        if (rejection.success) return { status: "rejected", reason: `Telegram rejected message (${rejection.data.error_code})`, retryable: rejection.data.error_code === 429 };
        const sent = sentSchema.safeParse(payload);
        if (response.ok && sent.success && sent.data.result.chat.id === chatId) {
          return { status: "accepted", messageId: telegramMessageId(chatId, sent.data.result.message_id) };
        }
        return { status: "unknown", reason: "Telegram response did not confirm the message identity" };
      } catch {
        // Telegram embeds the bot token in URLs, so never retain fetch errors or response descriptions.
        return { status: "unknown", reason: "Telegram delivery could not be confirmed" };
      }
    },

    async answerCallbackQuery(callbackQueryId: string): Promise<void> {
      try {
        if (!callbackQueryId.length || callbackQueryId.length > 256 || /[\u0000-\u001f\u007f]/.test(callbackQueryId)) throw new Error();
        const response = await request(`${base}/answerCallbackQuery`, {
          method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error",
          signal: AbortSignal.timeout(Math.min(timeout, 5_000)), body: JSON.stringify({ callback_query_id: callbackQueryId }),
        });
        if (!response.ok || !z.object({ ok: z.literal(true), result: z.literal(true) }).safeParse(await response.json()).success) throw new Error();
      } catch {
        throw new BadRequestError("Telegram callback could not be acknowledged");
      }
    },

    async downloadAttachment(mediaId: string): Promise<MessagingMedia> {
      const identity = parseAttachmentMediaId(MESSAGING_CHANNEL.telegram, mediaId), limit = Math.min(maxBytes, config.uploads.maxFileBytes);
      if (identity.sizeBytes !== undefined && identity.sizeBytes > limit) throw new BadRequestError("The attachment exceeds Telegram's download limit.");
      try {
        const response = await fetchWithRetry(request, `${base}/getFile`, () => ({
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: identity.providerId }),
          redirect: "error", signal: AbortSignal.timeout(timeout),
        }), "Telegram did not respond");
        if (!response.ok) throw new Error();
        const parsed = fileSchema.safeParse(await response.json().catch(() => null));
        if (!parsed.success || (parsed.data.result.file_size !== undefined && parsed.data.result.file_size > limit)) throw new Error();
        const metadata = parsed.data.result;
        const responseFile = await fetchWithRetry(request, mediaUrl(botToken, metadata.file_path), () => ({ redirect: "error", signal: AbortSignal.timeout(timeout) }), "Telegram did not respond");
        if (!responseFile.ok) throw new Error();
        const actualType = attachmentMime(responseFile.headers.get("content-type") ?? undefined);
        if (actualType && actualType !== "application/octet-stream" && identity.mimeType && actualType !== identity.mimeType) throw new Error();
        const bytes = await boundedAttachmentBytes(responseFile, limit);
        if ((metadata.file_size !== undefined && metadata.file_size !== bytes.byteLength) || (identity.sizeBytes !== undefined && identity.sizeBytes !== bytes.byteLength)) throw new Error();
        return { bytes, fileName: identity.fileName, mimeType: identity.mimeType ?? actualType ?? "application/octet-stream" };
      } catch { throw new BadRequestError("Telegram attachment could not be downloaded. Check its type and size."); }
    },

    async downloadAudio(mediaId: string): Promise<MessagingMedia> {
      const identity = parseTelegramMediaId(mediaId);
      try {
        const response = await fetchWithRetry(request, `${base}/getFile`, () => ({
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: identity.fileId }),
          redirect: "error", signal: AbortSignal.timeout(timeout),
        }), "Telegram audio could not be downloaded because Telegram did not respond. Send the voice note again.");
        if (!response.ok) throw new BadRequestError("Telegram audio metadata could not be loaded");
        const parsed = fileSchema.safeParse(await response.json().catch(() => null));
        // Telegram can return another valid file_id for the same file.
        if (!parsed.success) throw new BadRequestError("Telegram audio metadata is invalid");
        const metadata = parsed.data.result;
        if (metadata.file_size !== undefined && metadata.file_size > maxBytes) throw new BadRequestError("Telegram audio is too large");
        const audio = await fetchWithRetry(request, mediaUrl(botToken, metadata.file_path), () => ({ redirect: "error", signal: AbortSignal.timeout(timeout) }),
          "Telegram audio could not be downloaded because Telegram did not respond. Send the voice note again.");
        if (!audio.ok) throw new BadRequestError("Telegram audio could not be downloaded");
        const actualType = audio.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
        const expected = identity.mimeType ? telegramAudioFormat(identity.mimeType) : undefined;
        const downloaded = actualType ? telegramAudioFormat(actualType) : undefined;
        if (actualType && actualType !== "application/octet-stream" && (!downloaded || (expected && downloaded.mimeType !== expected.mimeType))) {
          throw new BadRequestError("Telegram audio type does not match its metadata");
        }
        const pathExtension = metadata.file_path.split(".").at(-1)!.toLowerCase();
        const pathMime = Object.hasOwn(audioPathMime, pathExtension) ? audioPathMime[pathExtension] : undefined;
        const format = expected ?? downloaded ?? (pathMime ? telegramAudioFormat(pathMime) : undefined);
        if (!format) throw new BadRequestError("Telegram audio type is unsupported");
        const bytes = await boundedBytes(audio, maxBytes);
        if (metadata.file_size !== undefined && bytes.byteLength !== metadata.file_size) throw new BadRequestError("Telegram audio size does not match its metadata");
        return { bytes, mimeType: format.mimeType, fileName: `voice-note.${format.extension}` };
      } catch (error) {
        // Our own errors carry fixed, token-free messages that name the failed step.
        if (error instanceof BadRequestError && error.message.startsWith("Telegram audio")) throw error;
        throw new BadRequestError("Telegram audio could not be downloaded. Send the voice note again.");
      }
    },
  };
}
