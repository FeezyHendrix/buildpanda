import { test } from "node:test";
import assert from "node:assert/strict";
import { stagesService } from "./service.ts";
import type {
  NewStageScheduleOfValueRecord,
  StagesRepository,
} from "./repository.ts";
import type { StageRow, StageScheduleOfValueRow } from "./types.ts";

interface Sink {
  records: NewStageScheduleOfValueRecord[];
}

function stageRow(over: Partial<StageRow> = {}): StageRow {
  return {
    id: "stage_1",
    project_id: "proj_1",
    building_id: "bld_1",
    name: "Superstructure",
    status: "InProgress",
    date_range: null,
    start_date: null,
    end_date: null,
    progress_percent: 0,
    value: "100000.00",
    sort_order: 0,
    contract_id: null,
    expected_cost: "0",
    estimated_labor_hours: "0",
    labor_budget: "0",
    material_budget: "0",
    ...over,
  };
}

function rowsFrom(sink: Sink): StageScheduleOfValueRow[] {
  return [...sink.records]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((record) => ({
      ...record,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }));
}

function progressRecord(
  period: string,
  percentComplete: number | null,
  over: Partial<NewStageScheduleOfValueRecord> = {},
): NewStageScheduleOfValueRecord {
  return {
    id: `sov_${period}`,
    project_id: "proj_1",
    stage_id: "stage_1",
    period,
    percent: "0",
    amount: "0.00",
    billed: false,
    sort_order: 0,
    percent_complete: percentComplete === null ? null : String(percentComplete),
    ...over,
  };
}

function fakeRepo(stage: StageRow, sink: Sink): StagesRepository {
  return {
    listByProject: async () => [stage],
    findById: async (id) => (id === stage.id ? stage : undefined),
    nextSortOrder: async () => 1,
    create: async () => stage,
    update: async () => stage,
    remove: async () => {},
    reorder: async () => {},
    countByContract: async () => [],
    listScheduleOfValuesByProject: async () => rowsFrom(sink),
    listScheduleOfValuesByStage: async () => rowsFrom(sink),
    replaceScheduleOfValues: async (_stageId, records) => {
      sink.records = records;
    },
    upsertScheduleProgress: async (record) => {
      const existing = sink.records.find((row) => row.period === record.period);
      if (existing) existing.percent_complete = record.percent_complete;
      else sink.records.push(progressRecord(record.period, null, { ...record }));
      [...sink.records]
        .sort((a, b) => a.period.localeCompare(b.period))
        .forEach((row, index) => {
          row.sort_order = index;
        });
    },
    markScheduleOfValuesBilled: async (_projectId, period, stageIds) => {
      for (const row of sink.records) {
        if (row.period === period && stageIds.includes(row.stage_id)) row.billed = true;
      }
    },
  };
}

function makeService(stage: StageRow, sink: Sink, contractSum?: number) {
  return stagesService(
    fakeRepo(stage, sink),
    async () => "bld_1",
    contractSum === undefined ? undefined : async () => contractSum,
  );
}

test("SoV amounts are percent-of-value and reconcile exactly to the billed total", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  const rows = await svc.replaceScheduleOfValues("proj_1", "stage_1", [
    { period: "2026-01", percent: 40 },
    { period: "2026-02", percent: 30 },
    { period: "2026-03", percent: 30 },
  ]);
  assert.deepEqual(
    rows.map((r) => r.amount),
    [40000, 30000, 30000],
  );
  assert.equal(
    rows.reduce((sum, r) => sum + r.amount, 0),
    100000,
  );
});

test("SoV: a 40% line on a 100,000 stage bills exactly 40,000 (ernest pay-app behavior)", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  const rows = await svc.replaceScheduleOfValues("proj_1", "stage_1", [
    { period: "2026-01", percent: 40 },
  ]);
  assert.equal(rows[0]?.amount, 40000);
});

test("SoV: an indivisible split still sums exactly (no lost cents)", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "100.00" }), sink);
  const rows = await svc.replaceScheduleOfValues("proj_1", "stage_1", [
    { period: "2026-01", percent: 33.3333 },
    { period: "2026-02", percent: 33.3333 },
    { period: "2026-03", percent: 33.3334 },
  ]);
  assert.equal(
    rows.reduce((sum, r) => sum + r.amount, 0),
    100,
  );
});

test("SoV: rejects billing more than 100% of the stage value", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow(), sink);
  await assert.rejects(
    svc.replaceScheduleOfValues("proj_1", "stage_1", [
      { period: "2026-01", percent: 60 },
      { period: "2026-02", percent: 50 },
    ]),
    /more than 100%/,
  );
});

test("stage value: rejects values that exceed the contract sum", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "0.00" }), sink, 50000);
  await assert.rejects(
    svc.update("proj_1", "stage_1", { value: 60000 }),
    /exceed the contract sum/,
  );
});

test("stage value: allows values within the contract sum", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "0.00" }), sink, 50000);
  const stage = await svc.update("proj_1", "stage_1", { value: 40000 });
  assert.equal(stage.id, "stage_1");
});

test("SoV: maps rows to DTOs (camelCase keys, numeric amounts)", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await svc.replaceScheduleOfValues("proj_1", "stage_1", [
    { period: "2026-01", percent: 50, billed: true },
  ]);
  const listed = await svc.listScheduleOfValues("proj_1", "stage_1");
  assert.equal(listed[0]?.stageId, "stage_1");
  assert.equal(listed[0]?.period, "2026-01");
  assert.equal(listed[0]?.amount, 50000);
  assert.equal(listed[0]?.billed, true);
});

test("progress: recording cumulative % prices the period as the movement since last month", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await svc.updateScheduleProgress("proj_1", "stage_1", "2026-01", 40);
  const rows = await svc.updateScheduleProgress("proj_1", "stage_1", "2026-02", 70);
  assert.deepEqual(
    rows.map((r) => [r.period, r.percentComplete, r.periodPercent, r.periodAmount, r.toDateAmount]),
    [
      ["2026-01", 40, 40, 40000, 40000],
      ["2026-02", 70, 30, 30000, 70000],
    ],
  );
});

test("progress: a month cannot fall below the previous recorded month", async () => {
  const sink: Sink = { records: [progressRecord("2026-01", 40)] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await assert.rejects(
    svc.updateScheduleProgress("proj_1", "stage_1", "2026-02", 30),
    (err: Error & { statusCode?: number }) => err.statusCode === 409 && /cannot fall below/.test(err.message),
  );
});

test("progress: a month cannot exceed the next recorded month", async () => {
  const sink: Sink = { records: [progressRecord("2026-03", 60)] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await assert.rejects(
    svc.updateScheduleProgress("proj_1", "stage_1", "2026-02", 75),
    (err: Error & { statusCode?: number }) => err.statusCode === 409 && /cannot exceed/.test(err.message),
  );
});

test("progress: clearing a month with a later recorded month is a 409 (clear right to left)", async () => {
  const sink: Sink = {
    records: [progressRecord("2026-01", 40), progressRecord("2026-02", 70, { sort_order: 1 })],
  };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await assert.rejects(
    svc.updateScheduleProgress("proj_1", "stage_1", "2026-01", null),
    (err: Error & { statusCode?: number }) => err.statusCode === 409 && /Clear 2026-02 first/.test(err.message),
  );
  const rows = await svc.updateScheduleProgress("proj_1", "stage_1", "2026-02", null);
  assert.equal(rows.find((r) => r.period === "2026-02")?.percentComplete, null);
});

test("progress: an unpriced stage rejects progress", async () => {
  const sink: Sink = { records: [] };
  const svc = makeService(stageRow({ value: "0.00" }), sink);
  await assert.rejects(
    svc.updateScheduleProgress("proj_1", "stage_1", "2026-01", 10),
    /Price the stage/,
  );
});

test("progress: replacing the planned schedule keeps the recorded % complete", async () => {
  const sink: Sink = { records: [progressRecord("2026-01", 40)] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  const rows = await svc.replaceScheduleOfValues("proj_1", "stage_1", [
    { period: "2026-01", percent: 50 },
    { period: "2026-02", percent: 50 },
  ]);
  assert.equal(rows[0]?.percentComplete, 40);
  assert.equal(rows[0]?.periodAmount, 40000);
  assert.equal(rows[1]?.percentComplete, null);
});

test("progress: marking a period billed flags only that month on the given stages", async () => {
  const sink: Sink = { records: [progressRecord("2026-01", 40), progressRecord("2026-02", 70, { sort_order: 1 })] };
  const svc = makeService(stageRow({ value: "100000.00" }), sink);
  await svc.markPeriodBilled("proj_1", "2026-02", ["stage_1"]);
  const rows = await svc.listScheduleOfValues("proj_1", "stage_1");
  assert.deepEqual(rows.map((r) => r.billed), [false, true]);
});
