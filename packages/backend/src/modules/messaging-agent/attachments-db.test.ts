import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import fastify from "fastify";
import knex, { type Knex } from "knex";
import { stageMessagingAttachment } from "./attachment-ingress.ts";
import { messagingSourceFiles } from "./source-files.ts";
import { messagingAgentRepository } from "./repository.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import messagingUploadRoutes from "./upload-routes.ts";
import type { MessagingWorkerDependencies } from "./worker-types.ts";
import type { MessagingUploadOptions } from "./attachment-types.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL ?? process.env.FIELD_ACTION_TEST_DATABASE_URL;

async function fixture(run: (db: Knex.Transaction, id: (name: string) => string) => Promise<void>) {
  const connection = knex({ client: "pg", connection: url }), db = await connection.transaction();
  const prefix = `attachment_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  try {
    await db("user").insert(["owner", "reader"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
    await db("organization").insert({ id: id("org"), name: "Attachment fixture", slug: id("org") });
    await db("member").insert({ id: id("member"), organizationId: id("org"), userId: id("owner"), role: "owner" });
    await db("projects").insert({ id: id("site"), name: "Site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN", organization_id: id("org"), owner_id: id("owner") });
    await db("project_participants").insert({ id: id("participant"), project_id: id("site"), user_id: id("reader"), email: `${id("reader")}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify({ project: ["view"], dailyLog: ["view"] }) });
    await db("messaging_agent_identity_links").insert(["owner", "reader"].map((name) => ({ id: id(`${name}_identity`), channel: "telegram", channel_account_id: "fixture", sender_id: id(name), user_id: id(name) })));
    await db("messaging_agent_conversations").insert(["owner", "reader"].map((name) => ({ id: id(`${name}_conversation`), identity_id: id(`${name}_identity`), organization_id: id("org"), project_id: id("site"), building_id: null })));
    await db("platform_settings").insert({ id: "singleton", feature_flags: JSON.stringify({ "projects.documents": false, "quality.dailyLogs": true }) }).onConflict("id").merge();
    await run(db, id);
  } finally { await db.rollback(); await connection.destroy(); }
}

function fakeFiles(db: Knex, id: (name: string) => string, calls: string[]) {
  return {
    async upload(ownerId: string, incoming: Parameters<NonNullable<MessagingUploadOptions["files"]>["upload"]>[1]) {
      calls.push("upload");
      const chunks: Buffer[] = [];
      for await (const chunk of incoming.data as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks), fileId = id(`file_${calls.length}`);
      await db("uploaded_files").insert({ id: fileId, owner_id: ownerId, project_id: incoming.projectId, file_name: incoming.fileName, mime_type: incoming.mimeType, size_bytes: bytes.byteLength, storage_path: "test/attachment" });
      return { id: fileId, fileName: incoming.fileName, mimeType: incoming.mimeType, sizeBytes: bytes.byteLength, createdAt: new Date().toISOString() };
    },
    async readBytes() { throw new Error("Original attachments are not transcribed"); },
  };
}

const adapter = { channel: "telegram", channelAccountId: "fixture", label: "Fixture", maxTextLength: 4096,
  connectUrl: () => null, canReply: () => true, async sendText() { throw new Error("No live sends"); }, async downloadAudio() { throw new Error("No audio download"); } };

test("provider originals require staging grants before download and survive retry without duplication", { skip: !url }, async () => fixture(async (db, id) => {
  const calls: string[] = [], files = fakeFiles(db, id, calls);
  const adapters = messagingAdapterRegistry([{ ...adapter, async downloadAttachment() { calls.push("download"); return { bytes: new Uint8Array([1, 2, 3]), fileName: "delivery.pdf", mimeType: "application/pdf" }; } }]);
  const deps = { adapters, files, now: () => new Date(), draft: async () => [], translate: async () => { throw new Error("Never translate a document"); } } as MessagingWorkerDependencies;
  const repo = messagingAgentRepository(db);
  const incoming = async (who: string) => (await repo.acceptMessage({ channel: "telegram", channelAccountId: "fixture", senderId: id(who), replyRecipientId: id(who), conversationType: "direct", providerMessageId: randomUUID(), sentAt: new Date(), type: "attachment", text: "Attach delivery note", mediaId: "provider-file", mediaMimeType: "application/pdf", replyToMessageId: null }))!;
  const owner = (await repo.identityForSender({ channel: "telegram", channelAccountId: "fixture", senderId: id("owner") }))!;
  const conversation = (await repo.conversation(owner.id))!, inbox = await incoming("owner");
  assert.equal(await stageMessagingAttachment(db, inbox, { identity: owner, conversation }, deps), "Attach delivery note");
  const saved = (await repo.inbox(inbox.id))!;
  assert.equal(saved.source_kind, "file_attachment"); assert.ok(saved.source_file_id);
  await stageMessagingAttachment(db, saved, { identity: owner, conversation }, deps);
  assert.deepEqual(calls, ["download", "upload"]);
  const source = await messagingSourceFiles(db, conversation.id, conversation.scope_version, inbox.id);
  assert.deepEqual(source, [{ id: saved.source_file_id, fileName: "delivery.pdf", mimeType: "application/pdf", sizeBytes: 3 }]);
  await db("uploaded_files").insert({ id: id("voice_file"), owner_id: owner.user_id, project_id: conversation.project_id, file_name: "voice-note.ogg", mime_type: "audio/ogg", size_bytes: 3, storage_path: "fixture/voice" });
  const voice = (await repo.acceptMessage({ channel: "telegram", channelAccountId: "fixture", senderId: owner.sender_id, replyRecipientId: owner.sender_id, conversationType: "direct", providerMessageId: randomUUID(), type: "audio", text: null, sentAt: new Date(), mediaId: "voice", mediaMimeType: "audio/ogg", replyToMessageId: null }))!;
  await repo.setInboxContent(voice.id, { sourceFileId: id("voice_file"), sourceKind: "voice_translation" });
  const next = await incoming("owner");
  assert.deepEqual(await messagingSourceFiles(db, conversation.id, conversation.scope_version, next.id), source);
  await assert.rejects(stageMessagingAttachment(db, saved, { identity: owner, conversation: { ...conversation, scope_version: conversation.scope_version + 1 } }, deps), /scope changed/);
  const reader = (await repo.identityForSender({ channel: "telegram", channelAccountId: "fixture", senderId: id("reader") }))!;
  const readerConversation = (await repo.conversation(reader.id))!;
  await assert.rejects(stageMessagingAttachment(db, await incoming("reader"), { identity: reader, conversation: readerConversation }, deps), /staging files/);
  assert.deepEqual(calls, ["download", "upload"]);
  await repo.resetContext(conversation.id);
  assert.deepEqual(await messagingSourceFiles(db, conversation.id, conversation.scope_version, inbox.id), []);
}));

function form(connectionId: string, text = "Log this delivery note") {
  const boundary = "panda_attachment_fixture";
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="connectionId"\r\n\r\n${connectionId}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${text}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="delivery.pdf"\r\nContent-Type: application/pdf\r\n\r\nPDF\r\n--${boundary}--\r\n`,
  ].join("")) };
}

test("web multipart upload stores the original and clarifies intent without committing a field record", { skip: !url }, async () => fixture(async (db, id) => {
  const calls: string[] = [], app = fastify();
  app.decorate("db", db);
  let currentUser = id("owner");
  app.decorateRequest("requireAuth", function () { return { id: currentUser, name: "Fixture", email: "fixture@test.invalid", emailVerified: true, image: null, role: "user" }; });
  await app.register(messagingUploadRoutes, { adapters: messagingAdapterRegistry([adapter]), files: fakeFiles(db, id, calls),
    draft: async () => { throw new MessagingClarificationError("What should this file be attached to?"); } });
  try {
    const response = await app.inject({ method: "POST", url: `/messaging-agent/projects/${id("site")}/messages/upload`, ...form(id("owner_identity"), "") });
    assert.equal(response.statusCode, 200, response.body);
    const body = response.json(); assert.equal(body.file.fileName, "delivery.pdf"); assert.equal(body.file.sizeBytes, 3);
    assert.deepEqual(Object.keys(body).sort(), ["file", "messageId"]);
    const inbox = (await messagingAgentRepository(db).inbox(body.messageId))!;
    assert.equal(inbox.source_file_id, body.file.id); assert.equal(inbox.source_kind, "file_attachment"); assert.equal(inbox.message_type, "attachment"); assert.equal(inbox.status, "processed");
    const proposal = await db("messaging_agent_proposals").where({ inbox_id: inbox.id }).first();
    assert.equal(proposal.source_file_id, body.file.id); assert.match(proposal.clarification, /attached to/);
    assert.equal(Number((await db("daily_log_entries").where({ project_id: id("site") }).count("*").first())!.count), 0);
    const malformed = form(id("owner_identity"));
    malformed.payload = Buffer.from(malformed.payload.toString().replace("--panda_attachment_fixture--", "--panda_attachment_fixture\r\nContent-Disposition: form-data; name=\"unknown\"\r\n\r\nignored\r\n--panda_attachment_fixture--"));
    const rejected = await app.inject({ method: "POST", url: `/messaging-agent/projects/${id("site")}/messages/upload`, ...malformed });
    assert.ok(rejected.statusCode >= 400); assert.deepEqual(calls, ["upload"]);
    currentUser = id("reader");
    const denied = await app.inject({ method: "POST", url: `/messaging-agent/projects/${id("site")}/messages/upload`, ...form(id("reader_identity")) });
    assert.equal(denied.statusCode, 403); assert.deepEqual(calls, ["upload"]);
  } finally { await app.close(); }
}));

test("an AI drafting failure retains the staged original and failed inbox for correction", { skip: !url }, async () => fixture(async (db, id) => {
  const calls: string[] = [], app = fastify();
  app.decorate("db", db);
  app.decorateRequest("requireAuth", function () { return { id: id("owner"), name: "Fixture", email: "fixture@test.invalid", emailVerified: true, image: null, role: "user" }; });
  await app.register(messagingUploadRoutes, { adapters: messagingAdapterRegistry([adapter]), files: fakeFiles(db, id, calls),
    draft: async () => { throw new Error("Injected drafting failure"); } });
  try {
    const response = await app.inject({ method: "POST", url: `/messaging-agent/projects/${id("site")}/messages/upload`, ...form(id("owner_identity")) });
    assert.equal(response.statusCode, 500);
    const inbox = await db("messaging_agent_inbox").where({ conversation_id: id("owner_conversation") }).first();
    assert.equal(inbox.status, "failed"); assert.ok(inbox.source_file_id);
    assert.ok(await db("uploaded_files").where({ id: inbox.source_file_id, owner_id: id("owner"), project_id: id("site") }).first());
    assert.equal((await messagingSourceFiles(db, inbox.conversation_id, inbox.scope_version, inbox.id))[0]?.id, inbox.source_file_id);
    assert.deepEqual(calls, ["upload"]);
  } finally { await app.close(); }
}));
