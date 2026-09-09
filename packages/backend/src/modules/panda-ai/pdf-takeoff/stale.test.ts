import { test } from "node:test";
import assert from "node:assert/strict";
import { withStale } from "./stale.ts";
import type { PreconSession } from "./types.ts";

const session = (id: string, planId: string | null): PreconSession =>
  ({ id, planId, title: id, takeoffKind: "manual", scope: { kind: "full", elements: [] } }) as unknown as PreconSession;

test("stale: one lookup for the whole list, deduplicated, marks only sessions whose plan was superseded", async () => {
  const calls: string[][] = [];
  const lookup = async (planIds: string[]) => {
    calls.push(planIds);
    return new Map([["pln_a", { newerPlanId: "pln_c", newerRevision: "C" }]]);
  };
  const out = await withStale([session("s1", "pln_a"), session("s2", "pln_b"), session("s3", "pln_a"), session("s4", null)], lookup);
  assert.deepEqual(calls, [["pln_a", "pln_b"]]);
  assert.deepEqual(
    out.map((s) => [s.id, s.stale]),
    [
      ["s1", { newerPlanId: "pln_c", newerRevision: "C" }],
      ["s2", null],
      ["s3", { newerPlanId: "pln_c", newerRevision: "C" }],
      ["s4", null],
    ],
  );
});

test("stale: sessions without a plan never hit the lookup", async () => {
  let called = 0;
  const out = await withStale([session("s1", null)], async () => {
    called += 1;
    return new Map();
  });
  assert.equal(called, 0);
  assert.equal(out[0]!.stale, null);
});
