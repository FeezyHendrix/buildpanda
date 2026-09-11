import { test } from "node:test";
import assert from "node:assert/strict";
import { enqueueUpdate, enqueueDelete, reviveOrQueue } from "./enqueue-update";

// A hand-written transaction over an in-memory outbox: enough of the drizzle
// surface for the helper, no SQLite. Conditions are matched by re-reading the
// bound values the drizzle `eq`/`and` builders carry.
type Row = { id: string; resource: string; entityId: string; projectId: string; operation: string; status: string; attempts: number; lastError: string | null };

function fakeTx(rows: Row[]) {
  const bound = (cond: unknown): Record<string, unknown> => {
    // drizzle SQL chunks: walk queryChunks collecting {column.name: param value}
    const out: Record<string, unknown> = {};
    const walk = (node: any) => {
      if (!node) return;
      if (Array.isArray(node.queryChunks)) {
        const chunks = node.queryChunks;
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          if (c && typeof c === "object" && "name" in c && "table" in c) {
            const p = chunks.slice(i + 1).find((x: any) => x && typeof x === "object" && "value" in x && "encoder" in x);
            if (p) out[(c as any).name] = (p as any).value;
          }
          walk(c);
        }
      }
    };
    walk(cond);
    return out;
  };
  const matches = (row: Row, cond: unknown) => {
    const b = bound(cond);
    const map: Record<string, keyof Row> = { id: "id", resource: "resource", entity_id: "entityId", operation: "operation" };
    return Object.entries(b).every(([col, val]) => row[map[col] ?? (col as keyof Row)] === val);
  };
  return {
    rows,
    select: () => ({ from: () => ({ where: (cond: unknown) => ({ limit: async () => rows.filter((r) => matches(r, cond)).map((r) => ({ id: r.id, status: r.status })) }) }) }),
    insert: () => ({ values: async (v: any) => { rows.push({ status: "pending", attempts: 0, lastError: null, ...v }); } }),
    update: () => ({ set: (vals: any) => ({ where: async (cond: unknown) => { rows.forEach((r) => { if (matches(r, cond)) Object.assign(r, vals); }); } }) }),
    delete: () => ({ where: async (cond: unknown) => { for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, cond)) rows.splice(i, 1); } }),
  };
}

const failedCreate = (): Row => ({ id: "o1", resource: "rfis", entityId: "local_1", projectId: "p", operation: "create", status: "failed", attempts: 8, lastError: "Invalid request" });

test("an edit after a failed create revives the create instead of queuing an orphan update", async () => {
  const tx = fakeTx([failedCreate()]);
  await enqueueUpdate(tx as never, "rfis", "local_1", "p", "o2");
  assert.equal(tx.rows.length, 1);
  assert.equal(tx.rows[0]!.status, "pending");
  assert.equal(tx.rows[0]!.attempts, 0);
  assert.equal(tx.rows[0]!.lastError, null);
});

test("a second edit coalesces onto the pending update; a failed update is revived", async () => {
  const tx = fakeTx([]);
  await enqueueUpdate(tx as never, "rfis", "srv_1", "p", "u1");
  await enqueueUpdate(tx as never, "rfis", "srv_1", "p", "u2");
  assert.deepEqual(tx.rows.map((r) => r.id), ["u1"]);
  tx.rows[0]!.status = "failed";
  await enqueueUpdate(tx as never, "rfis", "srv_1", "p", "u3");
  assert.deepEqual(tx.rows.map((r) => [r.id, r.status]), [["u1", "pending"]]);
});

test("deleting a record whose create failed drops the queue and pushes nothing", async () => {
  const tx = fakeTx([failedCreate()]);
  await enqueueDelete(tx as never, "rfis", "local_1", "p", "d1");
  assert.equal(tx.rows.length, 0);
});

test("reviveOrQueue inserts once and revives a failed row of the same operation", async () => {
  const tx = fakeTx([]);
  await reviveOrQueue(tx as never, { resource: "daily-logs", entityId: "p:2026-09-11", projectId: "p", operation: "upsert", newId: "q1" });
  await reviveOrQueue(tx as never, { resource: "daily-logs", entityId: "p:2026-09-11", projectId: "p", operation: "upsert", newId: "q2" });
  assert.deepEqual(tx.rows.map((r) => r.id), ["q1"]);
  tx.rows[0]!.status = "failed";
  await reviveOrQueue(tx as never, { resource: "daily-logs", entityId: "p:2026-09-11", projectId: "p", operation: "upsert", newId: "q3" });
  assert.deepEqual(tx.rows.map((r) => [r.id, r.status]), [["q1", "pending"]]);
});
