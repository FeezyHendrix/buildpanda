import assert from "node:assert/strict";
import { test } from "node:test";
import { attachmentMediaId, parseAttachmentMediaId } from "./attachment-media.ts";
import { parseTelegramUpdate } from "./adapters/telegram/normalize.ts";
import { telegramProvider } from "./adapters/telegram/provider.ts";
import { parseWhatsAppWebhook, whatsappProvider } from "./adapters/whatsapp/provider.ts";

const telegram = { enabled: true, botId: "123456", botToken: "123456:fake_token_for_injected_fetch_only", botUsername: "buildpanda_bot", webhookSecret: "fixture" };
const identity = { providerId: "File_123", mimeType: "application/pdf", fileName: "Delivery note.pdf", sizeBytes: 3 };

test("attachment identities preserve names and metadata without allowing provider URLs or local paths", () => {
  const encoded = attachmentMediaId("telegram", identity);
  assert.deepEqual(parseAttachmentMediaId("telegram", encoded), identity);
  assert.throws(() => parseAttachmentMediaId("whatsapp", encoded));
  for (const patch of [{ providerId: "https://evil.invalid/file" }, { fileName: "../private.pdf" }, { fileName: "bad\nname.pdf" }, { mimeType: "javascript:alert(1)" }, { sizeBytes: 0 }]) {
    assert.throws(() => attachmentMediaId("telegram", { ...identity, ...patch }));
  }
});

test("Telegram original documents, highest-resolution photos and videos retain captions and private routing", () => {
  const base = { message_id: 1, date: 1794657600, chat: { id: 7, type: "private" }, from: { id: 7, is_bot: false }, caption: "Attach this to the delivery" };
  for (const attachment of [
    { document: { file_id: "Document", file_name: "Delivery note.pdf", mime_type: "application/pdf", file_size: 3 } },
    { photo: [{ file_id: "Small", width: 10, height: 10 }, { file_id: "Original", width: 100, height: 100, file_size: 3 }] },
    { video: { file_id: "Video", file_name: "Pour.mp4", mime_type: "video/mp4", file_size: 3 } },
  ]) {
    const message = parseTelegramUpdate({ update_id: 1, message: { ...base, ...attachment } }, telegram).messages[0]!;
    assert.equal(message.type, "attachment"); assert.equal(message.text, base.caption); assert.equal(message.senderId, "tg:7:7");
    const file = parseAttachmentMediaId("telegram", message.mediaId!);
    assert.equal(file.providerId, "document" in attachment ? "Document" : "photo" in attachment ? "Original" : "Video");
  }
});

test("WhatsApp image, document and video attachments keep captions and original document filenames", () => {
  const messages = ["image", "document", "video"].map((type) => ({ id: type, type, from: "sender", timestamp: "1794657600", [type]: { id: "Media123", mime_type: type === "image" ? "image/jpeg" : type === "video" ? "video/mp4" : "application/pdf", filename: "Original file.pdf", caption: "Delivery evidence" } }));
  const result = parseWhatsAppWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "100" }, messages } }] }] }, "100");
  for (const message of result.messages) {
    assert.equal(message.type, "attachment"); assert.equal(message.text, "Delivery evidence");
    assert.equal(parseAttachmentMediaId("whatsapp", message.mediaId!).fileName, "Original file.pdf");
  }
});

test("Telegram attachment download validates trusted path, type and real streamed size", async () => {
  let calls = 0;
  const provider = telegramProvider(telegram, async (url, init) => {
    calls++; assert.equal(init?.redirect, "error");
    if (calls === 1) return Response.json({ ok: true, result: { file_id: "Canonical", file_path: "documents/file.pdf", file_size: 3 } });
    assert.equal(String(url), `https://api.telegram.org/file/bot${telegram.botToken}/documents/file.pdf`);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/pdf", "content-length": "3" } });
  });
  const file = await provider.downloadAttachment(attachmentMediaId("telegram", identity));
  assert.equal(file.fileName, identity.fileName); assert.equal(file.bytes.byteLength, 3);
  for (const path of ["../secret", "https://evil.invalid/file", "documents/../secret"]) {
    let attempts = 0;
    const unsafe = telegramProvider(telegram, async () => { attempts++; return Response.json({ ok: true, result: { file_id: "Canonical", file_path: path, file_size: 3 } }); });
    await assert.rejects(unsafe.downloadAttachment(attachmentMediaId("telegram", identity)), /attachment could not/);
    assert.equal(attempts, 1);
  }
  const wrongSize = telegramProvider(telegram, async (url) => String(url).endsWith("getFile") ? Response.json({ ok: true, result: { file_id: "File", file_path: "documents/file.pdf", file_size: 3 } }) : new Response(new Uint8Array([1, 2])));
  await assert.rejects(wrongSize.downloadAttachment(attachmentMediaId("telegram", identity)), /attachment could not/);
});

test("WhatsApp attachment bytes are bounded and only downloaded from the trusted provider host", async () => {
  const settings = { accessToken: "fixture-token", phoneNumberId: "100", apiVersion: "v24.0", maxMediaBytes: 3 };
  const encoded = attachmentMediaId("whatsapp", identity);
  for (const target of ["http://lookaside.fbsbx.com/file", "https://evil.invalid/file"]) {
    let calls = 0;
    const provider = whatsappProvider(settings, async () => { calls++; return Response.json({ url: target, mime_type: identity.mimeType, file_size: 3 }); });
    await assert.rejects(provider.downloadAttachment(encoded), /not trusted/); assert.equal(calls, 1);
  }
  let calls = 0;
  const provider = whatsappProvider(settings, async (_url, init) => {
    calls++; assert.equal(init?.redirect, "error"); assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-token");
    return calls === 1 ? Response.json({ url: "https://lookaside.fbsbx.com/file", mime_type: identity.mimeType, file_size: 3 }) : new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": identity.mimeType } });
  });
  assert.equal((await provider.downloadAttachment(encoded)).fileName, identity.fileName);
  const oversized = whatsappProvider(settings, async () => Response.json({ url: "https://lookaside.fbsbx.com/file", mime_type: identity.mimeType, file_size: 4 }));
  await assert.rejects(oversized.downloadAttachment(encoded), /upload limit/);
});
