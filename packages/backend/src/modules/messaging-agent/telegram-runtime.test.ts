import assert from "node:assert/strict";
import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { test } from "node:test";
import { hashPassword } from "better-auth/crypto";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const redisUrl = process.env.MESSAGING_AGENT_TEST_REDIS_URL;

test("the production backend keeps WhatsApp and Telegram private while text and voice require confirmation", { skip: !databaseUrl || !redisUrl }, async () => {
  const database = new URL(databaseUrl!);
  Object.assign(process.env, {
    NODE_ENV: "test", DB_HOST: database.hostname, DB_PORT: database.port || "5432",
    DB_NAME: database.pathname.slice(1), DB_USER: decodeURIComponent(database.username), DB_PASSWORD: decodeURIComponent(database.password),
    REDIS_URL: redisUrl!, RUN_WORKERS: "false", RATE_LIMIT_ENABLED: "false", LOG_LEVEL: "error",
    BETTER_AUTH_SECRET: "panda-dual-runtime-test-secret-only-32-characters", BETTER_AUTH_URL: "http://localhost:3000",
    SENDBYTE_API_KEY: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", API_PAYLOAD_KEY: "",
    WHATSAPP_ENABLED: "true", WHATSAPP_VERIFY_TOKEN: "dual-runtime-test", WHATSAPP_APP_SECRET: "dual-runtime-test",
    WHATSAPP_ACCESS_TOKEN: "never-sent", WHATSAPP_PHONE_NUMBER_ID: "155555511111", WHATSAPP_BUSINESS_NUMBER: "+15555551111", WHATSAPP_API_VERSION: "v25.0",
    TELEGRAM_ENABLED: "true", TELEGRAM_BOT_ID: "123456789", TELEGRAM_BOT_TOKEN: "123456789:runtime_telegram_token_secret_only",
    TELEGRAM_BOT_USERNAME: "buildpanda_test_bot", TELEGRAM_WEBHOOK_SECRET: "runtime_telegram_webhook_secret_only_32_characters",
  });
  const { buildApp } = await import("../../server.ts");
  const { messagingAgentWorker } = await import("./worker.ts");
  const { messagingAdapterRegistry } = await import("./channels.ts");
  const { whatsappChannelAdapter } = await import("./adapters/whatsapp/adapter.ts");
  const { whatsappProvider } = await import("./adapters/whatsapp/provider.ts");
  const { telegramChannelAdapter } = await import("./adapters/telegram/adapter.ts");
  const { telegramProvider } = await import("./adapters/telegram/provider.ts");
  const { parseTelegramMessageId, telegramMessageId, telegramSenderId } = await import("./adapters/telegram/identifiers.ts");
  const { config } = await import("../../config/index.ts");
  const app = await buildApp(), suffix = randomUUID();
  const userId = `dual-runtime-${suffix}`, organizationId = `dual-runtime-org-${suffix}`;
  const projectId = `dual-runtime-project-${suffix}`, buildingId = `dual-runtime-building-${suffix}`;
  const senderId = `US.${suffix}`, chatId = randomInt(1_000_000_000, 2_000_000_000), telegramSender = telegramSenderId(chatId, chatId);
  const email = `${userId}@agent.invalid`, password = "Local-fixture-password-93", voiceBytes = Buffer.from("OggS-runtime-voice-fixture");
  const translatedText = "Eight workers completed the Telegram voice slab.";
  const sent: { channel: string; body: Record<string, unknown> }[] = [], inboxIds: string[] = [];
  const storedAudio = new Map<string, { bytes: Buffer; fileName: string; mimeType: string }>();
  const effects = { getFile: 0, downloads: 0, uploads: 0, translations: 0 };
  let telegramSequence = 0, sentSequence = 9000;
  try {
    await app.ready();
    assert.equal((await app.inject({ url: "/messaging-agent/status" })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/telegram/webhook", payload: { update_id: 1 } })).statusCode, 403);
    await app.db("user").insert({ id: userId, name: "Dual runtime crew", email, emailVerified: true });
    await app.db("account").insert({ id: `dual-runtime-account-${suffix}`, accountId: userId, providerId: "credential", userId, password: await hashPassword(password) });
    await app.db("organization").insert({ id: organizationId, name: "Dual runtime fixture", slug: organizationId });
    await app.db("member").insert({ id: `dual-runtime-member-${suffix}`, organizationId, userId, role: "owner" });
    await app.db("projects").insert({ id: projectId, organization_id: organizationId, owner_id: userId, name: "Runtime site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
    await app.db("buildings").insert({ id: buildingId, project_id: projectId, name: "Runtime block" });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", headers: { host: "localhost:3000", origin: "http://localhost:5175" }, payload: { email, password } });
    assert.equal(signIn.statusCode, 200, signIn.body);
    const cookies = signIn.headers["set-cookie"];
    const cookie = (Array.isArray(cookies) ? cookies : [cookies]).filter((value): value is string => typeof value === "string").map((value) => value.split(";", 1)[0]).join("; ");
    assert.ok(cookie);
    async function status() {
      const response = await app.inject({ url: "/messaging-agent/status", headers: { cookie } });
      assert.equal(response.statusCode, 200, response.body); return response.json();
    }
    const configured = await status();
    assert.equal(configured.userId, userId);
    assert.deepEqual(configured.channels.map((channel: { id: string }) => channel.id).sort(), ["telegram", "whatsapp"]);
    assert.deepEqual(configured.connections, []);

    const externalRequest: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      assert.equal(init?.redirect, "error");
      if (url.hostname === "graph.facebook.com") {
        assert.equal(url.pathname, `/v25.0/${config.whatsapp.phoneNumberId}/messages`);
        const body = JSON.parse(String(init?.body));
        assert.equal(body.to, senderId); sent.push({ channel: "whatsapp", body });
        return Response.json({ messages: [{ id: `wamid.dual.reply.${++sentSequence}` }] });
      }
      assert.equal(url.hostname, "api.telegram.org");
      if (url.pathname === `/bot${config.telegram.botToken}/sendMessage`) {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.chat_id, chatId); assert.equal(Object.hasOwn(body, "parse_mode"), false);
        assert.equal(body.reply_parameters.allow_sending_without_reply, true);
        assert.ok(Number.isSafeInteger(body.reply_parameters.message_id));
        sent.push({ channel: "telegram", body });
        return Response.json({ ok: true, result: { message_id: ++sentSequence, chat: { id: chatId, type: "private" } } });
      }
      if (url.pathname === `/bot${config.telegram.botToken}/getFile`) {
        effects.getFile += 1;
        assert.deepEqual(JSON.parse(String(init?.body)), { file_id: "Runtime_Voice-123" });
        return Response.json({ ok: true, result: { file_id: "Runtime_Voice-123", file_path: "voice/runtime.ogg", file_size: voiceBytes.length } });
      }
      assert.equal(url.pathname, `/file/bot${config.telegram.botToken}/voice/runtime.ogg`);
      effects.downloads += 1;
      return new Response(voiceBytes, { headers: { "content-type": "audio/ogg", "content-length": String(voiceBytes.length) } });
    };
    const worker = messagingAgentWorker(app.db, {
      adapters: messagingAdapterRegistry([
        whatsappChannelAdapter(config.whatsapp, whatsappProvider(config.whatsapp, externalRequest)),
        telegramChannelAdapter(config.telegram, telegramProvider(config.telegram, externalRequest)),
      ]),
      files: {
        upload: async (ownerId, input) => {
          effects.uploads += 1;
          const chunks: Buffer[] = []; for await (const chunk of input.data) chunks.push(Buffer.from(chunk));
          const bytes = Buffer.concat(chunks), id = `dual-runtime-audio-${suffix}`;
          assert.equal(ownerId, userId); assert.equal(input.projectId, projectId); assert.deepEqual(bytes, voiceBytes);
          storedAudio.set(id, { bytes, fileName: input.fileName, mimeType: input.mimeType });
          await app.db("uploaded_files").insert({ id, owner_id: ownerId, project_id: input.projectId, file_name: input.fileName, mime_type: input.mimeType, size_bytes: bytes.length, storage_path: "test-only" });
          return { id, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: bytes.length, createdAt: new Date().toISOString() };
        },
        readBytes: async (id) => storedAudio.get(id) ?? null,
      },
      translate: async (audio) => { effects.translations += 1; assert.deepEqual(Buffer.from(await audio.arrayBuffer()), voiceBytes); return translatedText; },
      draft: async (text, scope) => [{ kind: "daily_log", title: "Add daily site note", payload: { buildingId: scope.buildingId, logDate: "2026-11-14", bodyText: text } }],
    });
    async function link(channel: "whatsapp" | "telegram") {
      const response = await app.inject({ method: "POST", url: "/messaging-agent/link", headers: { cookie },
        payload: { channel, accountId: channel === "telegram" ? config.telegram.botId : config.whatsapp.phoneNumberId, projectId, buildingId } });
      assert.equal(response.statusCode, 200, response.body); return response.json();
    }
    async function whatsapp(text: string) {
      const providerMessageId = `wamid.dual.${randomUUID()}`;
      const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
        metadata: { phone_number_id: config.whatsapp.phoneNumberId }, messages: [{ id: providerMessageId, from_user_id: senderId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
      } }] }] });
      const signature = `sha256=${createHmac("sha256", config.whatsapp.appSecret).update(raw).digest("hex")}`;
      const response = await app.inject({ method: "POST", url: "/whatsapp/webhook", payload: raw,
        headers: { "content-type": "application/json", "x-hub-signature-256": signature } });
      assert.equal(response.statusCode, 200, response.body);
      const inbox = await app.db("messaging_agent_inbox").where({ channel: "whatsapp", channel_account_id: config.whatsapp.phoneNumberId, provider_message_id: providerMessageId }).first();
      assert.ok(inbox); inboxIds.push(inbox.id); await worker.processInbox(inbox.id); return inbox;
    }
    async function telegram(message: Record<string, unknown>, messageId = ++telegramSequence) {
      const response = await app.inject({ method: "POST", url: "/telegram/webhook",
        headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": config.telegram.webhookSecret },
        payload: { update_id: messageId, message: { message_id: messageId, date: Math.floor(Date.now() / 1000), chat: { id: chatId, type: "private" }, from: { id: chatId, is_bot: false }, ...message } } });
      assert.equal(response.statusCode, 200, response.body);
      const query = () => app.db("messaging_agent_inbox").where({ channel: "telegram", channel_account_id: config.telegram.botId, provider_message_id: telegramMessageId(chatId, messageId) }).first();
      const inbox = await query(); assert.ok(inbox); inboxIds.push(inbox.id);
      await worker.processInbox(inbox.id); return (await query())!;
    }
    const countRecords = async () => Number((await app.db("daily_log_entries").where({ project_id: projectId }).count("* as count").first())!.count);
    async function proposal(inboxId: string) {
      const row = await app.db("messaging_agent_proposals").where({ inbox_id: inboxId }).first(); assert.ok(row); return row;
    }
    async function flushReplies() {
      const pending = await app.db("messaging_agent_outbox").whereIn("inbox_id", inboxIds).where({ status: "pending" });
      for (const row of pending) {
        await worker.processOutbox(row.id);
        const accepted = await app.db("messaging_agent_outbox").where({ id: row.id }).first();
        assert.equal(accepted.status, "accepted", accepted.last_error);
        if (row.channel === "telegram") {
          assert.equal(parseTelegramMessageId(accepted.provider_message_id).chatId, chatId);
          const source = await app.db("messaging_agent_inbox").where({ id: row.inbox_id }).first();
          assert.deepEqual(sent.at(-1)?.body.reply_parameters, { message_id: parseTelegramMessageId(source.provider_message_id).messageId, allow_sending_without_reply: true });
        }
      }
    }

    const waLink = await link("whatsapp"), wrongCode = await telegram({ text: `/start ${waLink.code}` });
    assert.equal(wrongCode.status, "failed"); assert.equal((await status()).connections.length, 0);
    const unconsumed = await app.db("messaging_agent_link_codes").where({ code_hash: createHash("sha256").update(waLink.code).digest("hex") }).first();
    assert.equal(unconsumed.consumed_at, null);
    await whatsapp(`LINK ${waLink.code}`);
    const tgLink = await link("telegram"); assert.equal(tgLink.connectUrl, `https://t.me/buildpanda_test_bot?start=${tgLink.code}`);
    const tgLinked = await telegram({ text: `/start@buildpanda_test_bot ${tgLink.code}` });
    assert.equal(tgLinked.status, "processed"); assert.equal(tgLinked.source_text, "LINK [code redacted]");
    const connected = await status(); assert.equal(connected.connections.length, 2);
    const waConnection = connected.connections.find((connection: { channel: string }) => connection.channel === "whatsapp");
    const tgConnection = connected.connections.find((connection: { channel: string }) => connection.channel === "telegram");
    assert.deepEqual(waConnection.selectedScope, { projectId, buildingId }); assert.deepEqual(tgConnection.selectedScope, { projectId, buildingId });

    const waText = "Twelve workers completed the WhatsApp slab.", tgText = "Ten workers completed the Telegram text slab.";
    const waInbox = await whatsapp(waText), waProposal = await proposal(waInbox.id);
    const wrongConfirm = await telegram({ text: `/confirm ${waProposal.id} ${waProposal.version}` });
    assert.equal(wrongConfirm.status, "failed"); assert.equal(await countRecords(), 0);
    const tgInbox = await telegram({ text: tgText }), tgProposal = await proposal(tgInbox.id);
    assert.equal(await countRecords(), 0);
    for (const [connection, ownInbox, otherInbox, ownProposal, otherProposal] of [
      [waConnection, waInbox, tgInbox, waProposal, tgProposal], [tgConnection, tgInbox, waInbox, tgProposal, waProposal],
    ]) {
      const response = await app.inject({ url: `/messaging-agent/projects/${projectId}/session?connectionId=${connection.id}`, headers: { cookie } });
      assert.equal(response.statusCode, 200, response.body);
      const session = response.json();
      assert.ok(session.messages.some((message: { id: string }) => message.id === ownInbox.id));
      assert.ok(session.messages.every((message: { id: string }) => message.id !== otherInbox.id));
      assert.ok(session.messages.every((message: { text: string }) => !message.text.includes(otherInbox.source_text)));
      assert.ok(session.proposals.some((review: { id: string }) => review.id === ownProposal.id));
      assert.ok(session.proposals.every((review: { id: string }) => review.id !== otherProposal.id));
    }
    const confirmWA = () => app.inject({ method: "POST", url: `/messaging-agent/projects/${projectId}/proposals/${waProposal.id}/confirm`, headers: { cookie }, payload: { version: waProposal.version } });
    const waSaved = await confirmWA(); assert.equal(waSaved.statusCode, 200, waSaved.body); assert.equal(waSaved.json().status, "completed");
    assert.equal((await confirmWA()).json().result.recordId, waSaved.json().result.recordId); assert.equal(await countRecords(), 1);
    const confirmText = `/confirm ${tgProposal.id} ${tgProposal.version}`;
    const tgConfirm = await telegram({ text: confirmText }); assert.equal(tgConfirm.status, "processed");
    await telegram({ text: confirmText }, parseTelegramMessageId(tgConfirm.provider_message_id).messageId);
    await telegram({ text: confirmText }); assert.equal(await countRecords(), 2);
    const voiceMessage = { voice: { file_id: "Runtime_Voice-123", mime_type: "audio/ogg", duration: 3 } };
    const voice = await telegram(voiceMessage), voiceProposal = await proposal(voice.id);
    assert.equal(voice.status, "processed"); assert.equal(voice.source_kind, "voice_translation");
    assert.equal(voice.source_text, translatedText); assert.equal(voiceProposal.source_text, translatedText);
    assert.ok(voice.source_file_id); assert.equal(voiceProposal.source_file_id, voice.source_file_id); assert.deepEqual(storedAudio.get(voice.source_file_id)?.bytes, voiceBytes);
    assert.equal(await countRecords(), 2);
    await telegram(voiceMessage, parseTelegramMessageId(voice.provider_message_id).messageId);
    assert.deepEqual(effects, { getFile: 1, downloads: 1, uploads: 1, translations: 1 });
    assert.equal(Number((await app.db("messaging_agent_inbox").where({ channel: "telegram", sender_id: telegramSender }).whereIn("provider_message_id", [voice.provider_message_id, tgConfirm.provider_message_id]).count("* as count").first())!.count), 2);
    const voiceConfirmed = await telegram({ text: `/confirm ${voiceProposal.id} ${voiceProposal.version}` });
    assert.equal(voiceConfirmed.status, "processed"); assert.equal(await countRecords(), 3);
    assert.deepEqual((await app.db("daily_log_entries").where({ project_id: projectId }).select("body_text")).map((row) => row.body_text).sort(), [waText, tgText, translatedText].sort());
    await flushReplies();
    assert.ok(sent.some((message) => message.channel === "whatsapp")); assert.ok(sent.some((message) => message.channel === "telegram"));
    const unlink = await app.inject({ method: "DELETE", url: `/messaging-agent/connections/${tgConnection.id}`, headers: { cookie } });
    assert.equal(unlink.statusCode, 204, unlink.body);
    assert.deepEqual((await status()).connections.map((connection: { id: string }) => connection.id), [waConnection.id]);
    await whatsapp("HELP"); await flushReplies(); assert.equal(sent.at(-1)?.channel, "whatsapp");
  } finally {
    try {
      await app.db("messaging_agent_inbox").where({ channel: "whatsapp", sender_id: senderId }).orWhere({ channel: "telegram", sender_id: telegramSender }).delete();
      await app.db("projects").where({ id: projectId }).delete();
      await app.db("organization").where({ id: organizationId }).delete();
      await app.db("user").where({ id: userId }).delete();
    } finally { await app.close(); }
  }
});
