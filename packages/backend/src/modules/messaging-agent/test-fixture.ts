import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import knex from "knex";
import { normalizeReview } from "./draft.ts";
import { messagingAgentRepository } from "./repository.ts";
import { linkCodeHash } from "./service.ts";
import type { MessagingInboundMessage, MessagingSendResult } from "./types.ts";
import { messagingAgentWorker } from "./worker.ts";
import type { MessagingWorkerOptions } from "./worker-types.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import type { MessagingChannelAdapter } from "./channel-types.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const grants = { project: ["view"], dailyLog: ["view", "create"], buildings: ["view"] };

export async function fixture(run: (f: Awaited<ReturnType<typeof createFixture>>) => Promise<void>) {
  const f = await createFixture();
  try { await run(f); } finally {
    await f.db("messaging_agent_inbox").where({ sender_id: f.sender.senderId }).delete();
    await f.db("projects").whereIn("id", [f.scope.projectId, f.otherScope.projectId]).delete();
    await f.db("organization").where({ id: f.scope.organizationId }).delete();
    await f.db("user").whereIn("id", [f.userId, f.ownerId]).delete();
    await f.db.destroy();
  }
}

export async function createFixture() {
  const db = knex({ client: "pg", connection: url, pool: { min: 0, max: 10 } });
  const prefix = `ma_worker_${randomUUID()}`;
  const id = (name: string) => `${prefix}_${name}`;
  const userId = id("crew"), ownerId = id("owner"), now = new Date();
  const scope = { organizationId: id("org"), projectId: id("project"), buildingId: id("building") };
  const otherScope = { ...scope, projectId: id("other_project"), buildingId: id("other_building") };
  const sender = { channel: "test-messenger", channelAccountId: id("account"), senderId: `US.${randomUUID()}` };
  await db("user").insert([userId, ownerId].map((user) => ({ id: user, name: "Crew", email: `${user}@test.invalid` })));
  await db("organization").insert({ id: scope.organizationId, name: "Company", slug: scope.organizationId });
  await db("projects").insert([scope, otherScope].map((site) => ({ id: site.projectId, organization_id: site.organizationId, owner_id: ownerId, name: "Authorized project", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" })));
  await db("buildings").insert([scope, otherScope].map((site) => ({ id: site.buildingId, project_id: site.projectId, name: "Selected building" })));
  await db("project_participants").insert([scope, otherScope].map((site) => ({ id: id(site.projectId), project_id: site.projectId, user_id: userId, email: `${userId}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(grants) })));
  const repo = messagingAgentRepository(db);
  async function code(account = sender) {
    const value = randomUUID();
    await repo.createLinkCode({ ...scope, channel: account.channel, channelAccountId: account.channelAccountId, userId, codeHash: linkCodeHash(value), expiresAt: new Date(now.getTime() + 60_000) });
    return value;
  }
  async function link(account = sender) {
    const result = await repo.consumeLinkCode(linkCodeHash(await code(account)), account, now);
    assert.ok(result); return result;
  }
  async function receive(text: string | null, extra: Partial<MessagingInboundMessage> = {}) {
    const inbox = await repo.acceptMessage({ ...sender, replyRecipientId: sender.senderId, conversationType: "direct", providerMessageId: randomUUID(), sentAt: now,
      type: "text", text, mediaId: null, mediaMimeType: null, replyToMessageId: null, ...extra });
    assert.ok(inbox); return inbox;
  }
  const sent: string[] = [], effects = { downloads: 0, uploads: 0, translations: 0, drafts: 0 };
  let outcome: MessagingSendResult | undefined;
  const bytes = Buffer.from("original voice bytes");
  const adapter: MessagingChannelAdapter = {
    ...sender, label: "Test messenger", maxTextLength: 4096, connectUrl: () => null,
    canReply: (lastInboundAt, clock) => lastInboundAt !== null && clock.getTime() - new Date(lastInboundAt).getTime() < 24 * 60 * 60_000,
    sendText: async (message) => { sent.push(message.text); return outcome ?? { status: "accepted", messageId: `reply.${randomUUID()}` }; },
    downloadAudio: async () => { effects.downloads++; return { bytes, mimeType: "audio/ogg", fileName: "voice-note.ogg" }; },
  };
  const options: MessagingWorkerOptions = {
    adapters: messagingAdapterRegistry([adapter]), now: () => now,
    files: {
      upload: async (owner, input) => {
        effects.uploads++;
        const stored: Buffer[] = []; for await (const chunk of input.data) stored.push(Buffer.from(chunk));
        assert.deepEqual(Buffer.concat(stored), bytes);
        const fileId = id(`file_${effects.uploads}`);
        await db("uploaded_files").insert({ id: fileId, owner_id: owner, project_id: input.projectId, file_name: input.fileName, mime_type: input.mimeType, size_bytes: bytes.length, storage_path: "test-only" });
        return { id: fileId, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: bytes.length, createdAt: now.toISOString() };
      },
      readBytes: async () => ({ bytes, fileName: "voice-note.ogg", mimeType: "audio/ogg" }),
    },
    translate: async (audio) => { effects.translations++; assert.deepEqual(Buffer.from(await audio.arrayBuffer()), bytes); return "Eight workers. Slab poured — 12m³."; },
    draft: async (text, selected) => {
      effects.drafts++;
      return normalizeReview([{ kind: "daily_log", title: "Site note", payload: { logDate: "2026-11-14", buildingId: selected.buildingId, bodyText: text } }], selected);
    },
  };
  const worker = (overrides: Partial<MessagingWorkerOptions> = {}) => messagingAgentWorker(db, { ...options, ...overrides });
  async function reply(inboxId: string) { return db("messaging_agent_outbox").where({ inbox_id: inboxId }).first(); }
  return { db, id, now, userId, ownerId, sender, scope, otherScope, repo, link, code, receive, sent, effects, options, adapter, worker, reply, setOutcome: (next: MessagingSendResult) => { outcome = next; } };
}
