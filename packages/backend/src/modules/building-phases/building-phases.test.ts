import { test } from "node:test";
import assert from "node:assert/strict";
import { stagesService } from "../stages/service.ts";
import type { StagesRepository } from "../stages/repository.ts";
import type { StageRow } from "../stages/types.ts";
import type { BuildingPhasesRepository } from "./repository.ts";
import { buildingPhasesService, phaseProgress } from "./service.ts";
import type { BuildingPhaseRow, PhaseStageRow } from "./types.ts";

const stage = (status: PhaseStageRow["status"], progress: number, phaseId = "bp_1"): PhaseStageRow => ({
  building_phase_id: phaseId,
  status,
  progress_percent: progress,
});

const phaseRow = (over: Partial<BuildingPhaseRow> = {}): BuildingPhaseRow => ({
  id: "bp_1",
  project_id: "p_1",
  building_id: "b_1",
  name: "Sub-structure",
  sort_order: 0,
  created_by: "u_1",
  created_at: "",
  updated_at: "",
  ...over,
});

function phases(rows: BuildingPhaseRow[], stages: PhaseStageRow[] = []) {
  const removed: string[] = [];
  const repo = {
    listByProject: async () => rows,
    findById: async (id: string) => rows.find((row) => row.id === id),
    nextSortOrder: async () => rows.length,
    create: async (record: BuildingPhaseRow) => {
      if (rows.some((row) => row.name.toLowerCase() === record.name.toLowerCase())) throw { code: "23505" };
      return record;
    },
    rename: async (id: string, name: string) => ({ ...phaseRow({ id }), name }),
    remove: async (id: string) => void removed.push(id),
  } as unknown as BuildingPhasesRepository;
  const service = buildingPhasesService(repo, {
    stagesForProject: async () => stages,
    soleRealBuildingId: async () => "b_1",
    buildingBelongsToProject: async (_projectId, buildingId) => buildingId === "b_1",
  });
  return { service, removed };
}

test("phaseProgress derives count, average progress and status", () => {
  assert.deepEqual(phaseProgress([]), { stageCount: 0, progressPercent: 0, status: "Not started" });
  assert.equal(phaseProgress([stage("Pending", 0), stage("Pending", 0)]).status, "Not started");
  assert.equal(phaseProgress([stage("Done", 100), stage("Done", 100)]).status, "Completed");
  assert.deepEqual(phaseProgress([stage("Done", 100), stage("Pending", 0), stage("InProgress", 33)]), {
    stageCount: 3,
    progressPercent: 44,
    status: "In Progress",
  });
  assert.equal(phaseProgress([stage("Done", 100), stage("Pending", 0)]).status, "In Progress");
});

test("list derives each phase from its own stages only", async () => {
  const { service } = phases(
    [phaseRow(), phaseRow({ id: "bp_2", name: "MEP" })],
    [stage("Done", 100), stage("InProgress", 50, "bp_2"), stage("Pending", 0, "bp_2")],
  );
  const [first, second] = await service.list("p_1");
  assert.deepEqual([first?.stageCount, first?.status], [1, "Completed"]);
  assert.deepEqual([second?.stageCount, second?.progressPercent, second?.status], [2, 25, "In Progress"]);
});

test("create trims the name, attributes the actor and rejects bad or duplicate names", async () => {
  const { service } = phases([phaseRow()]);
  const created = await service.create("p_1", "u_9", { name: "  Finishes  " });
  assert.equal(created.name, "Finishes");
  assert.equal(created.buildingId, "b_1");
  await assert.rejects(service.create("p_1", "u_9", { name: "   " }), /1 to 80 characters/);
  await assert.rejects(service.create("p_1", "u_9", { name: "x".repeat(81) }), /1 to 80 characters/);
  await assert.rejects(service.create("p_1", "u_9", { name: "sub-structure" }), /already exists/);
  await assert.rejects(service.create("p_1", "u_9", { name: "Roof", buildingId: "b_other" }), /does not belong/);
});

test("rename and remove 404 on another project's phase; remove is blocked while stages remain", async () => {
  const { service, removed } = phases([phaseRow(), phaseRow({ id: "bp_empty", name: "MEP" })], [stage("Pending", 0)]);
  await assert.rejects(service.rename("p_other", "bp_1", "X"), /not found/i);
  await assert.rejects(service.remove("p_other", "bp_empty"), /not found/i);
  await assert.rejects(service.remove("p_1", "bp_1"), /Move them to another phase first/);
  await service.remove("p_1", "bp_empty");
  assert.deepEqual(removed, ["bp_empty"]);
});

const stageRow = (id: string, over: Partial<StageRow> = {}): StageRow =>
  ({ id, project_id: "p_1", building_id: "b_1", building_phase_id: null, name: id, status: "Pending", progress_percent: 0, value: "0", sort_order: 0, ...over }) as StageRow;

function stages(rows: StageRow[]) {
  const calls: unknown[][] = [];
  const repo = {
    listByProject: async () => rows,
    findById: async (id: string) => rows.find((row) => row.id === id),
    nextSortOrder: async () => rows.length,
    create: async (record: StageRow) => record,
    update: async (id: string, patch: Partial<StageRow>) => ({ ...stageRow(id), ...patch }),
    reorder: async (...args: unknown[]) => void calls.push(args),
  } as unknown as StagesRepository;
  const scope: Record<string, { project_id: string; building_id: string }> = {
    bp_1: { project_id: "p_1", building_id: "b_1" },
    bp_foreign: { project_id: "p_other", building_id: "b_9" },
    bp_other_building: { project_id: "p_1", building_id: "b_2" },
  };
  const service = stagesService(repo, async () => "b_1", undefined, undefined, undefined, undefined, async (id) => scope[id]);
  return { service, calls };
}

test("a stage can only be assigned to a phase of its own project and building", async () => {
  const { service } = stages([stageRow("s_1")]);
  assert.equal((await service.create("p_1", { name: "Slab", buildingPhaseId: "bp_1" })).buildingPhaseId, "bp_1");
  assert.equal((await service.create("p_1", { name: "Slab" })).buildingPhaseId, null);
  assert.equal((await service.update("p_1", "s_1", { buildingPhaseId: null })).buildingPhaseId, null);
  for (const phaseId of ["bp_foreign", "bp_other_building", "bp_missing"]) {
    await assert.rejects(service.create("p_1", { name: "Slab", buildingPhaseId: phaseId }), /does not belong/);
    await assert.rejects(service.update("p_1", "s_1", { buildingPhaseId: phaseId }), /does not belong/);
    await assert.rejects(service.reorder("p_1", ["s_1"], phaseId), /does not belong/);
  }
});

test("a service built without the phase lookup refuses to assign a phase", async () => {
  const service = stagesService({ nextSortOrder: async () => 0 } as unknown as StagesRepository, async () => "b_1");
  await assert.rejects(service.create("p_1", { name: "Slab", buildingPhaseId: "bp_1" }), /does not belong/);
});

test("phase reorder moves the listed stages into the phase and leaves the others in place", async () => {
  const { service, calls } = stages([stageRow("a"), stageRow("b"), stageRow("c"), stageRow("d")]);
  await service.reorder("p_1", ["d", "b"], "bp_1");
  assert.deepEqual(calls, [["p_1", ["a", "d", "c", "b"], { buildingPhaseId: "bp_1", stageIds: ["d", "b"] }]]);
  await assert.rejects(service.reorder("p_1", ["a", "a"], "bp_1"), /distinct stages/);
  await assert.rejects(service.reorder("p_1", ["a", "zz"], "bp_1"), /distinct stages/);
});
