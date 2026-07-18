import { test } from "node:test";
import assert from "node:assert/strict";
import { buildingsService } from "./service.ts";
import type { BuildingsRepository } from "./repository.ts";
import type { BuildingRow } from "./types.ts";

function realRow(over: Partial<BuildingRow> = {}): BuildingRow {
  return {
    id: "bld_1",
    project_id: "prj_1",
    name: "Block A",
    code: null,
    kind: "real",
    status: "active",
    progress_percent: 0,
    sort_order: 0,
    created_at: "2026-07-18T00:00:00Z",
    updated_at: "2026-07-18T00:00:00Z",
    ...over,
  };
}

function fakeRepo(rows: BuildingRow[], stageProgress: Map<string, number> = new Map()): BuildingsRepository {
  const store = [...rows];
  return {
    stageProgressByBuilding: async () => stageProgress,
    listByProject: async (projectId) =>
      store.filter((r) => r.project_id === projectId && r.kind === "real"),
    findById: async (id) => store.find((r) => r.id === id),
    sharedBuildingId: async (projectId) =>
      store.find((r) => r.project_id === projectId && r.kind === "shared")?.id,
    soleRealBuildingId: async (projectId) => {
      const real = store.filter((r) => r.project_id === projectId && r.kind === "real");
      return real.length === 1 ? real[0]!.id : undefined;
    },
    countReal: async (projectId) =>
      store.filter((r) => r.project_id === projectId && r.kind === "real").length,
    nextSortOrder: async (projectId) => {
      const real = store.filter((r) => r.project_id === projectId && r.kind === "real");
      return real.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
    },
    create: async (record) => {
      const row = realRow({ ...record, kind: "real" });
      store.push(row);
      return row;
    },
    update: async (id, patch) => {
      const row = store.find((r) => r.id === id && r.kind === "real");
      if (!row) return undefined;
      Object.assign(row, patch);
      return row;
    },
    remove: async (id) => {
      const idx = store.findIndex((r) => r.id === id && r.kind === "real");
      if (idx >= 0) store.splice(idx, 1);
    },
    reorder: async () => undefined,
    cloneStages: async () => 0,
    firstRealBuildingId: async (projectId) =>
      store.filter((r) => r.project_id === projectId && r.kind === "real")[0]?.id,
  };
}

test("list excludes the shared sentinel", async () => {
  const service = buildingsService(
    fakeRepo([
      realRow({ id: "bld_a", name: "Block A" }),
      realRow({ id: "bld_shared_prj_1", name: "Shared", kind: "shared", sort_order: -1 }),
    ]),
  );
  const result = await service.list("prj_1");
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, "bld_a");
});

test("a backfilled project reads as single-building (one real building)", async () => {
  const repo = fakeRepo([
    realRow({ id: "bld_a", name: "Main" }),
    realRow({ id: "bld_shared_prj_1", name: "Shared", kind: "shared", sort_order: -1 }),
  ]);
  assert.equal(await repo.countReal("prj_1"), 1);
  assert.equal(await repo.soleRealBuildingId("prj_1"), "bld_a");
});

test("create adds a real building and advances sort order", async () => {
  const service = buildingsService(
    fakeRepo([
      realRow({ id: "bld_a", name: "Block A", sort_order: 0 }),
      realRow({ id: "bld_shared_prj_1", name: "Shared", kind: "shared", sort_order: -1 }),
    ]),
  );
  const created = await service.create("prj_1", { name: "Block B" });
  assert.equal(created.kind, "real");
  assert.equal(created.sortOrder, 1);
  assert.equal((await service.list("prj_1")).length, 2);
});

test("progressPercent is clamped to 0..100", async () => {
  const service = buildingsService(fakeRepo([]));
  const created = await service.create("prj_1", { name: "B", progressPercent: 250 });
  assert.equal(created.progressPercent, 100);
});

test("update rejects a non-existent or non-real building", async () => {
  const service = buildingsService(
    fakeRepo([realRow({ id: "bld_shared_prj_1", kind: "shared", name: "Shared" })]),
  );
  await assert.rejects(() => service.update("prj_1", "bld_shared_prj_1", { name: "x" }));
  await assert.rejects(() => service.update("prj_1", "bld_missing", { name: "x" }));
});

test("update rejects a building from another project", async () => {
  const service = buildingsService(
    fakeRepo([realRow({ id: "bld_a", project_id: "prj_other", name: "A" })]),
  );
  await assert.rejects(() => service.update("prj_1", "bld_a", { name: "x" }));
});

test("cloneProgramme rejects when source or target is not a real building of the project", async () => {
  const service = buildingsService(
    fakeRepo([
      realRow({ id: "bld_a", name: "Block A" }),
      realRow({ id: "bld_shared_prj_1", name: "Shared", kind: "shared" }),
    ]),
  );
  await assert.rejects(() => service.cloneProgramme("prj_1", "bld_a", "bld_missing"));
  await assert.rejects(() => service.cloneProgramme("prj_1", "bld_missing", "bld_a"));
  await assert.rejects(() => service.cloneProgramme("prj_1", "bld_a", "bld_shared_prj_1"));
});

test("cloneProgramme succeeds between two real buildings", async () => {
  const service = buildingsService(
    fakeRepo([
      realRow({ id: "bld_a", name: "Block A" }),
      realRow({ id: "bld_b", name: "Block B" }),
    ]),
  );
  const result = await service.cloneProgramme("prj_1", "bld_b", "bld_a");
  assert.equal(result.clonedStages, 0);
});

test("list rolls up building progress from stage averages, falling back to stored value", async () => {
  const service = buildingsService(
    fakeRepo(
      [
        realRow({ id: "bld_a", name: "Block A", progress_percent: 5 }),
        realRow({ id: "bld_b", name: "Block B", progress_percent: 90 }),
      ],
      new Map([["bld_a", 50]]),
    ),
  );
  const result = await service.list("prj_1");
  const a = result.find((b) => b.id === "bld_a");
  const b = result.find((b) => b.id === "bld_b");
  assert.equal(a?.progressPercent, 50);
  assert.equal(b?.progressPercent, 90);
});
