import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex from "knex";
import { NotFoundError, ServiceUnavailableError } from "../../lib/errors.ts";
import { messagingAdapterRegistry } from "./channels.ts";
import type { MessagingChannelAdapter } from "./channel-types.ts";
import { messagingAgentService, linkCodeHash } from "./service.ts";
import { messagingAgentRepository } from "./repository.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const grants = { project: ["view"], dailyLog: ["view", "create"], buildings: ["view"] };

function adapter(channel: string, channelAccountId: string): MessagingChannelAdapter {
  return {
    channel, channelAccountId, label: `${channel} ${channelAccountId}`, maxTextLength: 4096,
    connectUrl: (code) => `https://messenger.invalid/connect?code=${code}`, canReply: () => true,
    async sendText() { assert.fail("Service tests must not send external messages"); },
    async downloadAudio() { assert.fail("Service tests must not download media"); },
  };
}

async function fixture(run: (f: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const f = await seed();
  try { await run(f); } finally {
    await f.db("projects").where({ id: f.id("project") }).delete();
    await f.db("organization").where({ id: f.id("org") }).delete();
    await f.db("user").whereIn("id", [f.id("owner"), f.id("crew")]).delete();
    await f.db.destroy();
  }
}

async function seed() {
  const db = knex({ client: "pg", connection: url });
  const prefix = `agent_service_${randomUUID()}`, id = (name: string) => `${prefix}_${name}`;
  await db("user").insert(["owner", "crew"].map((name) => ({ id: id(name), name, email: `${id(name)}@test.invalid` })));
  await db("organization").insert({ id: id("org"), name: "Service fixture", slug: id("org") });
  await db("projects").insert({ id: id("project"), organization_id: id("org"), owner_id: id("owner"), name: "Service fixture", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
  await db("buildings").insert([{ id: id("real"), project_id: id("project"), name: "Real" }, { id: id("shared"), project_id: id("project"), name: "Shared", kind: "shared" }]);
  await db("project_participants").insert({ id: id("participant"), project_id: id("project"), user_id: id("crew"), email: `${id("crew")}@test.invalid`, role: "site_agent", status: "active", grants: JSON.stringify(grants) });
  const adapters = messagingAdapterRegistry([adapter("chat-a", id("account_a")), adapter("chat-b", id("account_a")), adapter("chat-a", id("account_b"))]);
  const service = messagingAgentService(db, adapters), repo = messagingAgentRepository(db);
  async function connect(channel = "chat-a", accountId = id("account_a"), senderId = id("sender")) {
    const code = await service.link(id("crew"), { channel, accountId, projectId: id("project"), buildingId: id("real") });
    assert.equal(new URL(code.connectUrl!).searchParams.get("code"), code.code);
    const sender = { channel, channelAccountId: accountId, senderId };
    const linked = await repo.consumeLinkCode(linkCodeHash(code.code), sender); assert.ok(linked);
    return { ...linked, sender };
  }
  async function capture(linked: Awaited<ReturnType<typeof connect>>, source: string, providerMessageId = "same-provider-id") {
    const inbox = await repo.acceptMessage({ ...linked.sender, replyRecipientId: linked.sender.senderId, conversationType: "direct",
      providerMessageId, type: "text", text: source, sentAt: new Date(), mediaId: null, mediaMimeType: null, replyToMessageId: null });
    assert.ok(inbox);
    const proposal = await repo.createProposal({ conversationId: linked.conversation.id, inboxId: inbox.id, scopeVersion: linked.conversation.scope_version,
      sourceText: source, sourceKind: "text", actions: [{ kind: "daily_log", payload: { logDate: "2026-11-14", buildingId: id("real"), bodyText: source } }] });
    return { inbox, proposal };
  }
  return { db, id, repo, service, adapters, connect, capture };
}

test("service preserves current grants, canonical creation, history visibility and authorized real buildings", { skip: !url }, () => fixture(async (f) => {
  const { db, id, repo, service } = f;
  const linked = await f.connect();
  const { proposal } = await f.capture(linked, "Private retained source");
  const status = await service.status(id("crew"));
  assert.equal(status.userId, id("crew"));
  assert.equal(status.channels.length, 3);
  assert.deepEqual(status.connections[0]!.selectedScope, { projectId: id("project"), buildingId: id("real") });
  const initial = await service.session(id("crew"), id("project"), linked.identity.id);
  assert.equal(initial.connectionId, linked.identity.id);
  assert.deepEqual(initial.buildings.map((building) => building.id), [id("real")]);
  assert.equal(initial.messages.length, 1); assert.equal(initial.proposals.length, 1);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ ...grants, dailyLog: ["create"] }) });
  const createOnly = await service.session(id("crew"), id("project"), linked.identity.id);
  assert.deepEqual(createOnly.messages, []); assert.equal(createOnly.proposals.length, 1);
  assert.equal((await service.confirm(id("crew"), id("project"), proposal.id, 1)).status, "completed");
  assert.deepEqual((await service.session(id("crew"), id("project"), linked.identity.id)).proposals, []);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify(grants) });
  assert.equal((await service.session(id("crew"), id("project"), linked.identity.id)).proposals[0]!.status, "completed");
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({ ...grants, buildings: [] }) });
  assert.equal((await service.status(id("crew"))).connections[0]!.selectedScope, null);
  const deniedBuilding = await service.session(id("crew"), id("project"), linked.identity.id);
  assert.deepEqual(deniedBuilding.buildings, []); assert.equal(deniedBuilding.buildingId, null);
  assert.deepEqual(deniedBuilding.messages, []); assert.deepEqual(deniedBuilding.proposals, []);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify({}) });
  const deniedProject = await service.status(id("crew"));
  assert.deepEqual(deniedProject.projects, []); assert.equal(deniedProject.connections[0]!.selectedScope, null);
  await assert.rejects(service.session(id("crew"), id("project"), linked.identity.id), /role does not allow/);
  await db("project_participants").where({ id: id("participant") }).update({ grants: JSON.stringify(grants) });
  await db("messaging_agent_conversations").where({ id: linked.conversation.id }).update({ building_id: id("shared") });
  assert.equal((await service.status(id("crew"))).connections[0]!.selectedScope, null);
  assert.equal((await service.session(id("crew"), id("project"), linked.identity.id)).buildingId, null);
  assert.ok(await repo.identityForSender(linked.sender));
}));

test("same-project sessions, scope changes and unlink isolate channels, accounts, senders and ownership", { skip: !url }, () => fixture(async (f) => {
  const { db, id, repo, service } = f;
  const linked = [
    await f.connect("chat-a"), await f.connect("chat-b"),
    await f.connect("chat-a", id("account_b")), await f.connect("chat-a", id("account_a"), id("other_sender")),
  ];
  const captures = [];
  for (const [index, connection] of linked.entries()) {
    const capture = await f.capture(connection, `Private source ${index}`, index === 3 ? "other-sender-provider-id" : "same-provider-id");
    captures.push(capture);
    await repo.enqueueOutbox({ inboxId: capture.inbox.id, identityId: connection.identity.id, conversationId: connection.conversation.id,
      recipientId: connection.sender.senderId, scopeVersion: connection.conversation.scope_version, body: `Private reply ${index}`, idempotencyKey: `${capture.inbox.id}:reply` });
  }
  assert.equal((await service.status(id("crew"))).connections.length, 4);
  const unselected = await service.session(id("crew"), id("project"));
  assert.equal(unselected.connectionId, null); assert.deepEqual(unselected.messages, []); assert.deepEqual(unselected.proposals, []);
  for (const [index, connection] of linked.entries()) {
    const session = await service.session(id("crew"), id("project"), connection.identity.id);
    assert.equal(session.connectionId, connection.identity.id);
    assert.deepEqual(new Set(session.messages.map((message) => message.text)), new Set([`Private source ${index}`, `Private reply ${index}`]));
    assert.deepEqual(session.proposals.map((proposal) => proposal.id), [captures[index]!.proposal.id]);
  }
  await assert.rejects(service.session(id("owner"), id("project"), linked[0]!.identity.id), NotFoundError);
  await assert.rejects(service.unlink(id("owner"), linked[0]!.identity.id), NotFoundError);
  await db("buildings").insert({ id: id("second_real"), project_id: id("project"), name: "Second building" });
  await service.setScope(id("crew"), { projectId: id("project"), connectionId: linked[1]!.identity.id, buildingId: id("second_real") });
  assert.equal((await repo.proposal(captures[1]!.proposal.id))!.status, "cancelled");
  assert.equal((await repo.proposal(captures[0]!.proposal.id))!.status, "draft");
  assert.equal((await service.session(id("crew"), id("project"), linked[0]!.identity.id)).messages.length, 2);
  const onlySecondChannel = messagingAgentService(db, messagingAdapterRegistry([f.adapters.get("chat-b", id("account_a"))]));
  assert.deepEqual((await onlySecondChannel.status(id("crew"))).connections.map((connection) => connection.id), [linked[1]!.identity.id]);
  await assert.rejects(onlySecondChannel.session(id("crew"), id("project"), linked[0]!.identity.id), ServiceUnavailableError);
  await messagingAgentService(db, messagingAdapterRegistry([])).unlink(id("crew"), linked[0]!.identity.id);
  assert.equal(await repo.identityForSender(linked[0]!.sender), null);
  for (const connection of linked.slice(1)) assert.equal((await repo.identityForSender(connection.sender))!.id, connection.identity.id);
  await assert.rejects(service.link(id("crew"), { channel: "missing", accountId: "missing", projectId: id("project"), buildingId: id("real") }), ServiceUnavailableError);
}));
