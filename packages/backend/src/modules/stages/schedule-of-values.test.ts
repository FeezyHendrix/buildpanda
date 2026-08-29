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
    ...over,
  };
}

function rowsFrom(sink: Sink): StageScheduleOfValueRow[] {
  return sink.records.map((record) => ({
    ...record,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));
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
    listScheduleOfValuesByProject: async () => rowsFrom(sink),
    listScheduleOfValuesByStage: async () => rowsFrom(sink),
    replaceScheduleOfValues: async (_stageId, records) => {
      sink.records = records;
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
