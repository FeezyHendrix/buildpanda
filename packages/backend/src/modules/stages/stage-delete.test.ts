import { test } from "node:test";
import assert from "node:assert/strict";
import { isAppError } from "../../lib/errors.ts";
import { stagesService } from "./service.ts";
import type { StagesRepository } from "./repository.ts";
import type { StageRow } from "./types.ts";

function stageRow(over: Partial<StageRow> = {}): StageRow {
  return {
    id: "stage_1",
    project_id: "prj_1",
    building_id: "bld_1",
    name: "Drainage & culverts",
    status: "InProgress",
    date_range: null,
    start_date: null,
    end_date: null,
    progress_percent: 0,
    value: "38250000.00",
    sort_order: 0,
    contract_id: null,
    expected_cost: "0",
    estimated_labor_hours: "0",
    labor_budget: "0",
    material_budget: "0",
    ...over,
  };
}

function build(rows: StageRow[], activityCount: number, contractSum = 850000000) {
  const removed: string[] = [];
  const repository = {
    listByProject: async () => rows,
    findById: async (id: string) => rows.find((r) => r.id === id),
    remove: async (id: string) => {
      removed.push(id);
    },
  } as unknown as StagesRepository;
  const service = stagesService(
    repository,
    async () => "bld_1",
    async () => contractSum,
    undefined,
    undefined,
    async () => activityCount,
  );
  return { service, removed };
}

test("a stage carrying activities and value is a 409 that names both", async () => {
  const { service, removed } = build([stageRow()], 2);
  await assert.rejects(
    service.remove("prj_1", "stage_1"),
    (error: unknown) => {
      assert.ok(isAppError(error));
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /2 activities and a value of 38250000/);
      assert.deepEqual(error.details, { activities: 2, value: 38250000 });
      return true;
    },
  );
  assert.deepEqual(removed, []);
});

test("one activity reads as an activity, not 1 activities", async () => {
  const { service } = build([stageRow({ value: "0" })], 1);
  await assert.rejects(service.remove("prj_1", "stage_1"), /1 activity and a value of 0/);
});

test("a stage with value but no activities is still blocked — the value is contract money", async () => {
  const { service } = build([stageRow()], 0);
  await assert.rejects(service.remove("prj_1", "stage_1"), /0 activities and a value of 38250000/);
});

test("an empty, unpriced stage deletes", async () => {
  const { service, removed } = build([stageRow({ value: "0" })], 0);
  await service.remove("prj_1", "stage_1");
  assert.deepEqual(removed, ["stage_1"]);
});

test("deleting a stage from another project is a 404", async () => {
  const { service } = build([stageRow({ project_id: "prj_other" })], 0);
  await assert.rejects(service.remove("prj_1", "stage_1"), /not found/i);
});

test("the value summary states what is priced against the contract sum", async () => {
  const { service } = build(
    [stageRow({ id: "s1", value: "500000000" }), stageRow({ id: "s2", value: "300000000" })],
    0,
  );
  const summary = await service.valueSummary("prj_1");
  assert.equal(summary.valueTotal, 800000000);
  assert.equal(summary.contractSum, 850000000);
  assert.equal(summary.unallocated, 50000000);
  assert.equal(summary.allocatedPercent, 94.12);
});

test("with no contract sum the allocated share is zero rather than a divide by zero", async () => {
  const { service } = build([stageRow({ value: "100" })], 0, 0);
  const summary = await service.valueSummary("prj_1");
  assert.equal(summary.allocatedPercent, 0);
});
