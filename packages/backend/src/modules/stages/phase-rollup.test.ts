import { test } from "node:test";
import assert from "node:assert/strict";
import { phaseRollup, type PhaseRollupDeps } from "./phase-rollup.ts";
import { toStage } from "./stage-mapper.ts";
import type { StageRow } from "./types.ts";

// Each sum is stubbed the way Postgres returns it: one row per stage with a
// numeric-as-string total, and no row for a stage nothing was logged against.
function fakeDeps(over: Partial<PhaseRollupDeps> = {}): PhaseRollupDeps {
  return {
    dailyLogs: { hoursByPhase: async () => [{ phase_id: "stg_found", total: "37.50" }] },
    purchaseOrders: {
      committedByStage: async () => [
        { stage_id: "stg_found", total: "4000000.00" },
        { stage_id: "stg_frame", total: "2500000.125" },
      ],
    },
    transactions: {
      sumByStage: async () => [
        { stage_id: "stg_found", total: "1250000.50" },
        { stage_id: "stg_roof", total: "300000.00" },
      ],
    },
    mainContractId: async () => "con_main",
    ...over,
  };
}

function row(over: Partial<StageRow> = {}): StageRow {
  return {
    id: "stg_found",
    project_id: "prj_1",
    building_id: "bld_1",
    name: "Foundation",
    status: "InProgress",
    date_range: null,
    start_date: null,
    end_date: null,
    progress_percent: 40,
    value: "6000000.00",
    sort_order: 0,
    contract_id: null,
    expected_cost: "5100000.00",
    estimated_labor_hours: "120.00",
    labor_budget: "900000.00",
    material_budget: "4200000.00",
    ...over,
  };
}

test("forProject stitches labour hours, committed materials and expenses per stage", async () => {
  const rollup = await phaseRollup(fakeDeps()).forProject("prj_1");
  assert.deepEqual(rollup.usageByStage.get("stg_found"), {
    usedLaborHours: 37.5,
    usedMaterialCost: 4_000_000,
    totalCost: 5_250_000.5,
  });
  // Material only: total cost is the committed material spend.
  assert.deepEqual(rollup.usageByStage.get("stg_frame"), {
    usedLaborHours: 0,
    usedMaterialCost: 2_500_000.13,
    totalCost: 2_500_000.13,
  });
  // Expenses only: still appears, with material at zero.
  assert.deepEqual(rollup.usageByStage.get("stg_roof"), { usedLaborHours: 0, usedMaterialCost: 0, totalCost: 300_000 });
  assert.equal(rollup.mainContractId, "con_main");
});

test("forProject runs the sums once for the whole project, never per stage", async () => {
  const calls: string[] = [];
  const deps = fakeDeps({
    dailyLogs: { hoursByPhase: async (id) => { calls.push(`hours:${id}`); return []; } },
    purchaseOrders: { committedByStage: async (id) => { calls.push(`po:${id}`); return []; } },
    transactions: { sumByStage: async (id) => { calls.push(`tx:${id}`); return []; } },
  });
  await phaseRollup(deps).forProject("prj_9");
  assert.deepEqual([...calls].sort(), ["hours:prj_9", "po:prj_9", "tx:prj_9"]);
});

test("toStage exposes estimates, used figures and resolves a null contract to the main one", async () => {
  const rollup = await phaseRollup(fakeDeps()).forProject("prj_1");
  const stage = toStage(row(), rollup);
  assert.equal(stage.contractId, "con_main");
  assert.equal(stage.expectedCost, 5_100_000);
  assert.equal(stage.estimatedLaborHours, 120);
  assert.equal(stage.laborBudget, 900_000);
  assert.equal(stage.materialBudget, 4_200_000);
  assert.equal(stage.usedLaborHours, 37.5);
  assert.equal(stage.usedMaterialCost, 4_000_000);
  assert.equal(stage.totalCost, 5_250_000.5);

  const explicit = toStage(row({ id: "stg_new", contract_id: "con_co" }), rollup);
  assert.equal(explicit.contractId, "con_co");
  assert.deepEqual(
    [explicit.usedLaborHours, explicit.usedMaterialCost, explicit.totalCost],
    [0, 0, 0],
  );
});

test("toStage without a roll-up reports zero usage and the raw contract column", () => {
  const stage = toStage(row());
  assert.equal(stage.contractId, null);
  assert.equal(stage.totalCost, 0);
});
