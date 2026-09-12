import { test } from "node:test";
import assert from "node:assert/strict";
import { stageCostsService, type StageCostsDeps } from "./stage-costs.ts";
import type { FinancesRow } from "./types.ts";

// The two repository sums are stubbed the way Postgres returns them: one row
// per stage with a numeric-as-string total, and no row for a stage with no
// money attributed to it.
function fakeDeps(overrides: Partial<StageCostsDeps> = {}): StageCostsDeps {
  return {
    finances: {
      findSummary: async () => ({ project_id: "prj_1", currency: "NGN" }) as unknown as FinancesRow,
    },
    transactions: {
      sumByStage: async () => [
        { stage_id: "stg_found", total: "1250000.50" },
        { stage_id: "stg_roof", total: "300000.00" },
      ],
    },
    purchaseOrders: {
      committedByStage: async () => [
        { stage_id: "stg_found", total: "4000000.00" },
        { stage_id: "stg_frame", total: "2500000.125" },
      ],
    },
    ...overrides,
  };
}

test("byProject merges committed POs and actual expenses per stage", async () => {
  const result = await stageCostsService(fakeDeps()).byProject("prj_1");
  const byId = new Map(result.stages.map((s) => [s.stageId, s]));

  assert.deepEqual(byId.get("stg_found"), {
    stageId: "stg_found",
    committed: 4_000_000,
    actual: 1_250_000.5,
    currency: "NGN",
  });
  // A stage with only one side of the ledger still appears, with the other at zero.
  assert.deepEqual(byId.get("stg_roof"), { stageId: "stg_roof", committed: 0, actual: 300_000, currency: "NGN" });
  assert.deepEqual(byId.get("stg_frame"), { stageId: "stg_frame", committed: 2_500_000.13, actual: 0, currency: "NGN" });
  assert.equal(result.stages.length, 3);
});

test("byProject returns the endpoint shape with an empty list when nothing is attributed", async () => {
  const result = await stageCostsService(
    fakeDeps({
      transactions: { sumByStage: async () => [] },
      purchaseOrders: { committedByStage: async () => [] },
    }),
  ).byProject("prj_1");
  assert.deepEqual(result, { stages: [] });
});

test("byProject 404s when the project has no finances record", async () => {
  const svc = stageCostsService(fakeDeps({ finances: { findSummary: async () => undefined } }));
  await assert.rejects(svc.byProject("prj_x"), /not found/i);
});

test("byProject reads the three sums in parallel, each scoped to the project", async () => {
  const seen: string[] = [];
  const deps = fakeDeps({
    transactions: { sumByStage: async (id) => { seen.push(`tx:${id}`); return []; } },
    purchaseOrders: { committedByStage: async (id) => { seen.push(`po:${id}`); return []; } },
  });
  await stageCostsService(deps).byProject("prj_9");
  assert.deepEqual([...seen].sort(), ["po:prj_9", "tx:prj_9"]);
});
