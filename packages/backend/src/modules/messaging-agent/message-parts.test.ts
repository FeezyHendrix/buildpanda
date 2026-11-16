import assert from "node:assert/strict";
import { test } from "node:test";
import { messagingAdapterRegistry } from "./channels.ts";
import { messagingReplyParts } from "./message-parts.ts";
import { fixture } from "./test-fixture.ts";

const url = process.env.MESSAGING_AGENT_TEST_DATABASE_URL;
const buttons = [{ label: "Confirm" as const, command: "CONFIRM review-a 1" }, { label: "Cancel" as const, command: "CANCEL review-a 1" }];

test("long replies preserve every character and keep native buttons on the final bounded message", () => {
  const body = "Project\n\n" + "Sand arrived. 🐼\n".repeat(500);
  const parts = messagingReplyParts(body, 4096, buttons, 1024);
  assert.equal(parts.slice(0, -1).map((part) => part.body).join(""), body);
  assert.ok(parts.every((part) => part.body.length <= (part.buttons ? 1024 : 4096)));
  assert.deepEqual(parts.at(-1)!.buttons, buttons);
  assert.ok(parts.slice(0, -1).every((part) => !part.buttons));
  assert.throws(() => messagingReplyParts("x".repeat(100_000), 4096), /too long/);
});

test("multipart review delivery preserves order and a changed review cancels every remaining part", { skip: !url }, async () => fixture(async (f) => {
  await f.link();
  const worker = f.worker({ adapters: messagingAdapterRegistry([{ ...f.adapter, maxButtonTextLength: 1024 }]) });
  const source = await f.receive("Site note: " + "x".repeat(5000)); await worker.processInbox(source.id);
  const parts = await f.db("messaging_agent_outbox").where({ inbox_id: source.id }).orderBy("part_index");
  assert.ok(parts.length >= 3);
  await worker.processOutbox(parts.at(-1)!.id);
  assert.equal((await f.repo.outbox(parts.at(-1)!.id))?.status, "pending"); assert.equal(f.sent.length, 0);
  await worker.processOutbox(parts[0]!.id); assert.equal(f.sent.length, 1);
  const corrected = await f.receive("Corrected short site note"); await worker.processInbox(corrected.id);
  for (const part of parts.slice(1)) { await worker.processOutbox(part.id); assert.equal((await f.repo.outbox(part.id))?.status, "cancelled"); }
  assert.equal(f.sent.length, 1);
}));

test("failed or uncertain earlier parts cannot deliver a later Confirm button", { skip: !url }, async () => fixture(async (f) => {
  await f.link();
  const worker = f.worker({ adapters: messagingAdapterRegistry([{ ...f.adapter, maxButtonTextLength: 1024 }]) });
  const source = await f.receive("Site note: " + "x".repeat(5000)); await worker.processInbox(source.id);
  const parts = await f.db("messaging_agent_outbox").where({ inbox_id: source.id }).orderBy("part_index");
  f.setOutcome({ status: "unknown", reason: "Timeout after provider acceptance" });
  await worker.processOutbox(parts[0]!.id); assert.equal((await f.repo.outbox(parts[0]!.id))?.status, "unknown");
  for (const part of parts.slice(1)) await worker.processOutbox(part.id);
  assert.equal((await f.repo.outbox(parts.at(-1)!.id))?.status, "cancelled"); assert.equal(f.sent.length, 1);
}));
