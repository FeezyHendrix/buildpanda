import { test } from "node:test";
import assert from "node:assert/strict";
import knexFactory from "knex";
import { agentRepository } from "./repository.ts";

/**
 * The dogfood run's worst answer was "which material orders are late": the
 * agent listed three orders a month in the future and missed the only one that
 * was actually late. These assert the SQL encodes the rule, not the model's
 * guess. Knex builds the statement without connecting, so no database is needed.
 */
const db = knexFactory({ client: "pg" });
const repo = agentRepository(db);

test("the late-orders query excludes anything already delivered, cancelled or rejected", () => {
  const sql = repo.lateMaterials("prj_1", "2026-09-13").toString();
  assert.match(sql, /"status" not in \('Delivered', 'Cancelled', 'Rejected'\)/);
});

test("the late-orders query is needed-by in the past, or promised after it was needed", () => {
  const sql = repo.lateMaterials("prj_1", "2026-09-13").toString();
  assert.match(sql, /"needed_by" < '2026-09-13'/);
  assert.match(sql, /expected_delivery_at IS NOT NULL AND expected_delivery_at > needed_by/);
  assert.match(sql, /"project_id" = 'prj_1'/);
});

test("the late-orders query never picks up a future needed-by on its own", () => {
  const sql = repo.lateMaterials("prj_1", "2026-09-13").toString();
  // No bare "needed_by > today" branch: a date in the future is not late.
  assert.ok(!/"needed_by" > /.test(sql));
});

test("deliveries are fetched in one batched read, not one query per order", () => {
  const sql = repo.deliveriesForOrders(["mo_1", "mo_2"]).toString();
  assert.match(sql, /"order_id" in \('mo_1', 'mo_2'\)/);
  // An empty id list must still be a single safe statement, not a crash.
  assert.ok(repo.deliveriesForOrders([]).toString().length > 0);
});
