import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWhatsAppWebhook, whatsappProvider } from "./provider.ts";
import type { MessagingReplyButton, MessagingSendInput } from "../../types.ts";

const config = { accessToken: "test-token", phoneNumberId: "1234", apiVersion: "v27.0", maxMediaBytes: 8 };
const envelope = (value: object) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
  metadata: { phone_number_id: "1234" }, ...value,
} }] }] });
const buttons: MessagingReplyButton[] = [
  { label: "Confirm", command: "CONFIRM maproposal_review 1" },
  { label: "Cancel", command: "CANCEL maproposal_review 1" },
];

test("text and audio normalize with opaque sender identity and original reply context", () => {
  const events = parseWhatsAppWebhook(envelope({ messages: [
    { id: "wamid.text", from: "2348000000000", from_user_id: "US.123abc", timestamp: "1700000000", type: "text", text: { body: "Ten workers" }, context: { id: "wamid.review" } },
    { id: "wamid.audio", from_user_id: "US.456def", timestamp: "1700000001", type: "audio", audio: { id: "345", mime_type: "audio/ogg; codecs=opus" } },
  ] }), "1234");
  assert.equal(events.messages.length, 2);
  assert.equal(events.messages[0]!.channel, "whatsapp");
  assert.equal(events.messages[0]!.channelAccountId, "1234");
  assert.equal(events.messages[0]!.senderId, "US.123abc");
  assert.equal(events.messages[0]!.replyRecipientId, "US.123abc");
  assert.equal(events.messages[0]!.conversationType, "direct");
  assert.equal(events.messages[0]!.replyToMessageId, "wamid.review");
  assert.equal(events.messages[0]!.text, "Ten workers");
  assert.equal(events.messages[1]!.senderId, "US.456def");
  assert.equal(events.messages[1]!.type, "audio");
  assert.equal(events.messages[1]!.mediaId, "345");
});

test("invalid envelopes, missing sender and foreign business numbers fail closed", () => {
  assert.throws(() => parseWhatsAppWebhook({}, "1234"), /Invalid (WhatsApp|Messaging)/);
  assert.throws(() => parseWhatsAppWebhook({ object: "messaging_agent_business_account", entry: [] }, "1234"), /Invalid (WhatsApp|Messaging)/);
  assert.throws(() => parseWhatsAppWebhook(envelope({ messages: [
    { id: "bad", timestamp: "1700000000", type: "text", text: { body: "No sender" } },
  ] }), "1234"), /identity/);
  assert.throws(() => parseWhatsAppWebhook(envelope({}), "another-number"), /business number/);
});

test("reply buttons use their command ID and preserve the verified sender and review context", () => {
  const { messages } = parseWhatsAppWebhook(envelope({ messages: buttons.map((button, index) => ({
    id: `wamid.button-${index}`, from: "2348000000000", from_user_id: "US.123abc", timestamp: "1700000000", type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: button.command, title: "An untrusted label" } },
    context: { id: "wamid.review" },
    text: { body: "Never use an unrelated text field" },
  })) }), "1234");
  assert.deepEqual(messages.map((message) => ({
    type: message.type, text: message.text, sender: message.senderId, recipient: message.replyRecipientId,
    replyTo: message.replyToMessageId, conversation: message.conversationType,
  })), buttons.map((button) => ({ type: "text", text: button.command, sender: "US.123abc", recipient: "US.123abc", replyTo: "wamid.review", conversation: "direct" })));
});

test("interactive labels, unknown button actions and malformed IDs cannot become review commands", () => {
  const interactive = [
    { type: "list_reply", button_reply: { id: buttons[0]!.command } },
    { type: "button_reply", button_reply: { id: "LINK another-account", title: buttons[0]!.command } },
    { type: "button_reply", button_reply: { id: "CONFIRM maproposal_review 0", title: "Confirm" } },
    { type: "button_reply", button_reply: { id: "CANCEL maproposal_review 1\nCONFIRM other 1", title: "Cancel" } },
    { type: "button_reply" },
  ];
  const { messages } = parseWhatsAppWebhook(envelope({ messages: interactive.map((value, index) => ({
    id: `wamid.unsupported-${index}`, from: "2348000000000", timestamp: "1700000000", type: "interactive", interactive: value,
  })) }), "1234");
  assert.ok(messages.every((message) => message.type === "unsupported" && message.text === null));
  assert.throws(() => parseWhatsAppWebhook(envelope({ messages: [{
    id: "wamid.no-actor", timestamp: "1700000000", type: "interactive", interactive: { type: "button_reply", button_reply: { id: buttons[0]!.command } },
  }] }), "1234"), /identity/);
});

test("delivery statuses retain provider IDs and ignore unsupported future states", () => {
  const { statuses } = parseWhatsAppWebhook(envelope({ statuses: [
    { id: "wamid.result", recipient_user_id: "US.123abc", status: "delivered", timestamp: "1700000000" },
    { id: "wamid.other", status: "future-status", timestamp: "1700000001" },
  ] }), "1234");
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0]!.channel, "whatsapp");
  assert.equal(statuses[0]!.channelAccountId, "1234");
  assert.equal(statuses[0]!.providerMessageId, "wamid.result");
  assert.equal(statuses[0]!.recipientId, "US.123abc");
});

test("send uses the official API with bearer auth and an explicit reply target", async () => {
  let called = false;
  const provider = whatsappProvider(config, async (url, init) => {
    called = true;
    assert.equal(String(url), "https://graph.facebook.com/v27.0/1234/messages");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.messaging_product, "whatsapp");
    assert.equal(body.recipient, "US.123abc");
    assert.equal(body.to, undefined);
    assert.equal(body.text.body, "Saved daily log");
    assert.equal(body.context.message_id, "wamid.input");
    return Response.json({ messages: [{ id: "wamid.output" }] });
  });
  assert.deepEqual(await provider.sendText({ to: "US.123abc", text: "Saved daily log", replyToMessageId: "wamid.input" }), {
    status: "accepted", messageId: "wamid.output",
  });
  assert.equal(called, true);
});

test("review sends native buttons with the complete spaced body and original reply target", async () => {
  const text = "Daily log review\n\nProject: North site\nBuilding: Block A\n\n1. Daily note\nTen workers completed the slab.\n\nChoose an action below.";
  const provider = whatsappProvider(config, async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      messaging_product: "whatsapp", recipient_type: "individual", recipient: "US.123abc", type: "interactive",
      interactive: { type: "button", body: { text }, action: {
        buttons: buttons.map((button) => ({ type: "reply", reply: { id: button.command, title: button.label } })),
      } },
      context: { message_id: "wamid.input" },
    });
    return Response.json({ messages: [{ id: "wamid.buttons" }] });
  });
  assert.deepEqual(await provider.sendText({ to: "US.123abc", text, buttons, replyToMessageId: "wamid.input" }), {
    status: "accepted", messageId: "wamid.buttons",
  });
});

test("button reviews enforce their own length limit and reject altered button pairs before sending", async () => {
  let calls = 0;
  const provider = whatsappProvider(config, async (_url, init) => {
    calls += 1;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.type === "interactive" ? body.interactive.body.text.length : body.text.body.length, body.type === "interactive" ? 1024 : 4096);
    return Response.json({ messages: [{ id: `wamid.length-${calls}` }] });
  });
  assert.equal((await provider.sendText({ to: "123", text: "x".repeat(1024), buttons })).status, "accepted");
  assert.equal((await provider.sendText({ to: "123", text: "x".repeat(4096) })).status, "accepted");
  await assert.rejects(provider.sendText({ to: "123", text: "x".repeat(1025), buttons }), /length/);
  for (const invalid of [
    [], buttons.slice(0, 1), [...buttons, buttons[0]],
    [buttons[0], { ...buttons[1], command: "CANCEL different-proposal 1" }],
    [buttons[0], { ...buttons[1], command: "CANCEL maproposal_review 2" }],
    [{ ...buttons[0], label: "Save everything" }, buttons[1]],
    [{ ...buttons[0], command: "CONFIRM " + "x".repeat(70) + " 1" }, buttons[1]],
  ]) await assert.rejects(provider.sendText({ to: "123", text: "Review", buttons: invalid } as unknown as MessagingSendInput), /buttons/);
  assert.equal(calls, 2);
});

test("phone numbers and business-scoped IDs use distinct recipient fields for plain and button messages", async () => {
  let calls = 0;
  for (const to of ["+2348000000000", "US.13491208655302741918"]) for (const reviewButtons of [undefined, buttons]) {
    const provider = whatsappProvider(config, async (url, init) => {
      calls += 1;
      assert.equal(String(url), "https://graph.facebook.com/v27.0/1234/messages");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.to, to.startsWith("+") ? to : undefined);
      assert.equal(body.recipient, to.startsWith("US.") ? to : undefined);
      assert.equal(body.type, reviewButtons ? "interactive" : "text");
      return Response.json({ messages: [{ id: `wamid.recipient-${calls}` }] });
    });
    assert.equal((await provider.sendText({ to, text: "Review", ...(reviewButtons ? { buttons: reviewButtons } : {}) })).status, "accepted");
  }
  assert.equal(calls, 4);
});

test("timeout, server failure and missing receipt are unknown outcomes, never retry instructions", async () => {
  const requests: (typeof fetch)[] = [
    async () => { throw new Error("timeout after send"); },
    async () => new Response("", { status: 503 }),
    async () => Response.json({ success: true }),
  ];
  for (const request of requests) {
    const result = await whatsappProvider(config, request).sendText({ to: "2348000000000", text: "Saved" });
    assert.equal(result.status, "unknown");
  }
});

test("known rejection differs from rate-limit rejection and invalid input never sends", async () => {
  assert.deepEqual(await whatsappProvider(config, async () => new Response("", { status: 400 })).sendText({ to: "123", text: "Saved" }), {
    status: "rejected", reason: "Provider rejected message (400)", retryable: false,
  });
  assert.deepEqual(await whatsappProvider(config, async () => new Response("", { status: 429 })).sendText({ to: "123", text: "Saved" }), {
    status: "rejected", reason: "Provider rejected message (429)", retryable: true,
  });
  const neverSend = whatsappProvider(config, async () => { throw new Error("Must not be called"); });
  await assert.rejects(neverSend.sendText({ to: "../../other", text: "Saved" }), /recipient/);
  await assert.rejects(neverSend.sendText({ to: "123", text: "x".repeat(4097) }), /length/);
  assert.throws(() => whatsappProvider({ ...config, graphBaseUrl: "https://attacker.invalid" }), /configuration/);
});

test("audio downloads use validated metadata, trusted host, bounded bytes and matching MIME", async () => {
  const urls: string[] = [];
  const provider = whatsappProvider(config, async (url, init) => {
    urls.push(String(url));
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    return urls.length === 1
      ? Response.json({ url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=345", mime_type: "audio/ogg; codecs=opus", file_size: 3 })
      : new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/ogg" } });
  });
  const media = await provider.downloadAudio("345");
  assert.deepEqual([...media.bytes], [1, 2, 3]);
  assert.equal(media.fileName, "voice-note.ogg");
  assert.equal(media.mimeType, "audio/ogg");
  assert.equal(urls[0], "https://graph.facebook.com/v27.0/345?phone_number_id=1234");
});

test("untrusted, redirected and oversized media cannot exfiltrate the provider token", async () => {
  for (const url of ["http://lookaside.fbsbx.com/file", "https://attacker.invalid/file", "https://lookaside.fbsbx.com.attacker.invalid/file", "https://user:password@lookaside.fbsbx.com/file"]) {
    let calls = 0;
    const provider = whatsappProvider(config, async () => {
      calls += 1;
      return Response.json({ url, mime_type: "audio/ogg", file_size: 3 });
    });
    await assert.rejects(provider.downloadAudio("345"), /not trusted/);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const oversized = whatsappProvider(config, async () => {
    calls += 1;
    return calls === 1 ? Response.json({ url: "https://lookaside.fbsbx.com/file", mime_type: "audio/ogg", file_size: 3 })
      : new Response(new Uint8Array(9), { headers: { "Content-Type": "audio/ogg" } });
  });
  await assert.rejects(oversized.downloadAudio("345"), /too large/);
});
