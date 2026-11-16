import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import knex, { type Knex } from "knex";
import { up as legacyUp, down as legacyDown } from "../../db/migrations/20261114_whatsapp_channel.ts";
import { up, down } from "../../db/migrations/20261115_messaging_agent_channels.ts";
import { up as buttonsUp, down as buttonsDown } from "../../db/migrations/20261116_messaging_agent_reply_buttons.ts";

const databaseUrl = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;

test("reply button migration preserves legacy receipts and round-trips review metadata", { skip: !databaseUrl }, async () => {
  const db = knex({ client: "pg", connection: databaseUrl });
  const trx = await db.transaction(), schema = `buttons_${randomUUID().replaceAll("-", "")}`;
  try {
    await trx.raw("CREATE SCHEMA ??", [schema]); await trx.raw("SET LOCAL search_path TO ??, public", [schema]);
    await trx.schema.createTable("messaging_agent_outbox", (table) => { table.text("id").primary(); table.text("body"); });
    await trx("messaging_agent_outbox").insert({ id: "receipt", body: "Original\n\nreceipt" });
    await buttonsUp(trx);
    assert.deepEqual(await trx("messaging_agent_outbox").first(), { id: "receipt", body: "Original\n\nreceipt", buttons: null });
    const buttons = [{ label: "Confirm", command: "CONFIRM review-1 1" }, { label: "Cancel", command: "CANCEL review-1 1" }];
    await trx("messaging_agent_outbox").where({ id: "receipt" }).update({ buttons: JSON.stringify(buttons) });
    assert.deepEqual((await trx("messaging_agent_outbox").first()).buttons, buttons);
    await buttonsDown(trx);
    assert.deepEqual(await trx("messaging_agent_outbox").first(), { id: "receipt", body: "Original\n\nreceipt" });
  } finally { await trx.rollback(); await db.destroy(); }
});

async function fixture(run: (trx: Knex.Transaction, id: (name: string) => string, schema: string) => Promise<void>) {
  const db = knex({ client: "pg", connection: databaseUrl });
  const trx = await db.transaction();
  const prefix = randomUUID().replaceAll("-", "");
  const id = (name: string) => `ma_migration_${prefix}_${name}`;
  const schema = `ma_migration_${prefix}`;
  try {
    await trx.raw("CREATE SCHEMA ??", [schema]);
    await trx.raw("SET LOCAL search_path TO ??, public", [schema]);
    await legacyUp(trx);
    await trx("user").insert({ id: id("user"), name: "Migration fixture", email: `${id("user")}@test.invalid` });
    await trx("organization").insert({ id: id("org"), name: "Migration fixture", slug: id("org") });
    await trx("projects").insert({ id: id("project"), organization_id: id("org"), owner_id: id("user"), name: "Site", address: "Fixture", status: "On Track", risk: "Low", currency: "NGN" });
    await trx("buildings").insert({ id: id("building"), project_id: id("project"), name: "Block" });
    await trx("whatsapp_identity_links").insert({ id: id("identity"), business_phone_number_id: "155555500000", sender_id: "same-sender", user_id: id("user") });
    const scope = { organization_id: id("org"), project_id: id("project"), building_id: id("building") };
    await trx("whatsapp_link_codes").insert({ id: id("code"), user_id: id("user"), ...scope, code_hash: "a".repeat(64), expires_at: new Date(Date.now() + 60_000) });
    await trx("whatsapp_conversations").insert({ id: id("conversation"), identity_id: id("identity"), ...scope });
    await trx("whatsapp_inbox").insert({ id: id("inbox"), business_phone_number_id: "155555500000", provider_message_id: "provider-message", sender_id: "same-sender", identity_id: id("identity"), conversation_id: id("conversation"), ...scope, scope_version: 1, message_type: "text", source_text: "Original source", source_kind: "text", sent_at: new Date(), status: "processed" });
    await trx("whatsapp_proposals").insert({ id: id("proposal"), conversation_id: id("conversation"), inbox_id: id("inbox"), ...scope, scope_version: 1, source_text: "Original source", source_kind: "text", status: "completed" });
    await trx("whatsapp_actions").insert({ id: id("action"), proposal_id: id("proposal"), proposal_version: 1, position: 0, kind: "daily_log", payload: JSON.stringify({ bodyText: "Reviewed source" }), status: "committed", result: JSON.stringify({ recordId: "persisted-record" }) });
    await trx("whatsapp_outbox").insert({ id: id("outbox"), inbox_id: id("inbox"), identity_id: id("identity"), conversation_id: id("conversation"), recipient_id: "same-sender", body: "Saved receipt", scope_version: 1, idempotency_key: id("reply"), status: "read", provider_message_id: "provider-reply" });
    await run(trx, id, schema);
  } finally {
    await trx.rollback();
    await db.destroy();
  }
}

test("generic migration preserves existing WhatsApp identities, sources, actions and receipts, then rolls back cleanly", { skip: !databaseUrl }, async () => fixture(async (trx, id, schema) => {
  await up(trx);
  const identity = await trx("messaging_agent_identity_links").where({ id: id("identity") }).first();
  assert.equal(identity.channel, "whatsapp"); assert.equal(identity.channel_account_id, "155555500000");
  const code = await trx("messaging_agent_link_codes").where({ id: id("code") }).first();
  assert.equal(code.channel_account_id, "legacy-unbound"); assert.equal(code.code_hash, "a".repeat(64));
  assert.ok(new Date(code.expires_at).getTime() <= Date.now());
  const inbox = await trx("messaging_agent_inbox").where({ id: id("inbox") }).first();
  assert.equal(inbox.source_text, "Original source"); assert.equal(inbox.reply_recipient_id, "same-sender"); assert.equal(inbox.conversation_type, "direct");
  assert.equal(inbox.origin, "provider");
  const outbox = await trx("messaging_agent_outbox").where({ id: id("outbox") }).first();
  assert.equal(outbox.channel, "whatsapp"); assert.equal(outbox.channel_account_id, identity.channel_account_id); assert.equal(outbox.status, "read");
  assert.deepEqual((await trx("messaging_agent_actions").where({ id: id("action") }).first()).result, { recordId: "persisted-record" });
  await down(trx);
  assert.equal((await trx("whatsapp_identity_links").where({ id: id("identity") }).first()).business_phone_number_id, "155555500000");
  assert.equal((await trx("whatsapp_inbox").where({ id: id("inbox") }).first()).source_text, "Original source");
  assert.equal((await trx("whatsapp_outbox").where({ id: id("outbox") }).first()).provider_message_id, "provider-reply");
  assert.equal((await trx("whatsapp_proposals").where({ id: id("proposal") }).first()).status, "completed");
  assert.ok(new Date((await trx("whatsapp_link_codes").where({ id: id("code") }).first()).expires_at).getTime() <= Date.now());
  await legacyDown(trx);
  assert.deepEqual(await trx("information_schema.tables").where({ table_schema: schema }).pluck("table_name"), []);
}));

test("rollback refuses unrepresentable channels, group addresses, account collisions and active bound codes before modifying data", { skip: !databaseUrl }, async () => fixture(async (trx, id) => {
  await up(trx);
  await trx("messaging_agent_identity_links").insert({ id: id("telegram"), channel: "telegram", channel_account_id: "bot", sender_id: "same-sender", user_id: id("user") });
  await assert.rejects(down(trx), /non-WhatsApp records/);
  assert.equal((await trx("messaging_agent_identity_links").where({ id: id("telegram") }).first()).channel, "telegram");
  await trx("messaging_agent_identity_links").where({ id: id("telegram") }).delete();
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ conversation_type: "group" });
  await assert.rejects(down(trx), /group messages/);
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ conversation_type: "direct" });
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ reply_recipient_id: "separate-private-chat" });
  await assert.rejects(down(trx), /reply addresses differ/);
  assert.equal((await trx("messaging_agent_inbox").where({ id: id("inbox") }).first()).reply_recipient_id, "separate-private-chat");
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ reply_recipient_id: "same-sender", origin: "web" });
  await assert.rejects(down(trx), /message origins differ/);
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ origin: "provider", provider_message_id: "web:opaque-provider-id" });
  await assert.rejects(down(trx), /message origins differ/);
  await trx("messaging_agent_inbox").where({ id: id("inbox") }).update({ provider_message_id: "provider-message" });
  await trx("messaging_agent_outbox").insert({ id: id("collision"), channel: "whatsapp", channel_account_id: "other-account", inbox_id: id("inbox"), recipient_id: "same-sender", body: "Other receipt", idempotency_key: id("other-reply"), provider_message_id: "provider-reply" });
  await assert.rejects(down(trx), /collide across accounts/);
  await trx("messaging_agent_outbox").where({ id: id("collision") }).delete();
  await trx("messaging_agent_link_codes").where({ id: id("code") }).update({ channel_account_id: "bound-account", expires_at: new Date(Date.now() + 60_000) });
  await assert.rejects(down(trx), /unexpired account-bound/);
  await trx("messaging_agent_link_codes").where({ id: id("code") }).update({ expires_at: new Date(Date.now() - 1_000) });
  await down(trx);
  assert.ok(await trx("whatsapp_inbox").where({ id: id("inbox") }).first());
}));
