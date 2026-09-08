import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areasToSelections,
  plansToDocuments,
  programmeToSeed,
  programmeWeeks,
  rowsToMaterialOrders,
  scheduleToMilestones,
  setupFromStructure,
} from "./convert-mappers.ts";
import type { PreconBoqRowDto, PreconProgrammeTask } from "../panda-ai/pdf-takeoff/types.ts";
import type { PaymentScheduleItem, ProposalPlan } from "./types.ts";

function task(overrides: Partial<PreconProgrammeTask>): PreconProgrammeTask {
  return {
    id: "t",
    sessionId: "pcs_1",
    sort: 0,
    name: "Task",
    elementGroup: null,
    wbsCode: null,
    outlineLevel: 2,
    parentTaskId: null,
    durationDays: 5,
    predecessors: [],
    isMilestone: false,
    basis: null,
    confidence: "high",
    status: "verified",
    version: 1,
    verifiedBy: "usr_1",
    verifiedAt: null,
    startAt: "2026-09-15T00:00:00.000Z",
    finishAt: "2026-09-19T00:00:00.000Z",
    totalFloatDays: null,
    isCritical: false,
    origin: "ai",
    ...overrides,
  };
}

const PROGRAMME = {
  startDate: "2026-09-15T00:00:00.000Z",
  finishDate: "2026-10-30T00:00:00.000Z",
  tasks: [
    task({ id: "sub", name: "Substructure", outlineLevel: 1, elementGroup: "Substructure", finishAt: "2026-10-03T00:00:00.000Z" }),
    task({ id: "exc", name: "Excavation", parentTaskId: "sub", elementGroup: "Substructure", finishAt: "2026-09-19T00:00:00.000Z" }),
    task({ id: "fnd", name: "Strip foundation", parentTaskId: "sub", elementGroup: "Substructure", predecessors: [{ taskId: "exc", type: "FS", lagDays: 0 }], startAt: "2026-09-22T00:00:00.000Z", finishAt: "2026-10-03T00:00:00.000Z" }),
    task({ id: "ms1", name: "Foundation and DPC complete", parentTaskId: "sub", isMilestone: true, durationDays: 0, startAt: "2026-10-03T00:00:00.000Z", finishAt: "2026-10-03T00:00:00.000Z" }),
    task({ id: "sup", name: "Superstructure", outlineLevel: 1, elementGroup: "Internal and external walls", startAt: "2026-10-06T00:00:00.000Z", finishAt: "2026-10-30T00:00:00.000Z" }),
    task({ id: "blk", name: "Blockwork", parentTaskId: "sup", elementGroup: "Internal and external walls", predecessors: [{ taskId: "fnd", type: "FS", lagDays: 0 }, { taskId: "sub", type: "FS", lagDays: 0 }], startAt: "2026-10-06T00:00:00.000Z", finishAt: "2026-10-30T00:00:00.000Z" }),
    task({ id: "rej", name: "Rejected task", parentTaskId: "sup", status: "rejected" }),
  ],
};
const IDS = { projectId: "prj_1", buildingId: "bld_1", ownerId: "usr_1" };

test("programmeToSeed derives stages from outline level 1 and activities beneath them", () => {
  const seed = programmeToSeed(PROGRAMME, IDS);
  assert.deepEqual(seed.phases.map((p) => p.name), ["Substructure", "Superstructure"]);
  assert.equal(seed.phases[0]!.start_date, "2026-09-15");
  assert.equal(seed.phases[0]!.end_date, "2026-10-03");
  assert.equal(seed.phases[0]!.programme_task_id, "sub");
  // rejected tasks never reach the project
  assert.ok(!seed.activities.some((a) => a.name === "Rejected task"));
  const blockwork = seed.activities.find((a) => a.name === "Blockwork")!;
  assert.equal(blockwork.phase_id, seed.phases[1]!.id);
  assert.equal(blockwork.source, "proposal-handoff");
  assert.equal(blockwork.baseline_start_at, blockwork.planned_start_at);
  // links are rewritten to activity ids; a link to a stage task is dropped
  const deps = JSON.parse(blockwork.predecessors) as Array<{ activityId: string }>;
  assert.equal(deps.length, 1);
  assert.equal(deps[0]!.activityId, seed.activityIdByTaskId.get("fnd"));
});

test("programmeToSeed turns milestones and stage ends into key dates without duplicates", () => {
  const seed = programmeToSeed(PROGRAMME, IDS);
  const labels = seed.keyDates.map((k) => k.label);
  assert.deepEqual(labels, [
    "Project start",
    "Foundation and DPC complete",
    "Substructure complete",
    "Superstructure complete",
    "Project completion",
  ]);
  assert.equal(seed.keyDates.find((k) => k.label === "Foundation and DPC complete")!.programme_task_id, "ms1");
  assert.equal(seed.keyDates.find((k) => k.label === "Substructure complete")!.target_date, "2026-10-03");
});

test("scheduleToMilestones binds a stage to its programme task's stage and keeps the schedule item id", () => {
  const seed = programmeToSeed(PROGRAMME, IDS);
  const phaseByTaskId = new Map(seed.phases.map((p) => [p.programme_task_id, { id: p.id, name: p.name, building_id: p.building_id }]));
  const tasksById = new Map(PROGRAMME.tasks.map((t) => [t.id, t]));
  const schedule = [
    { id: "ps_1", estimateId: "est_1", label: "Advance", percent: 20, description: null, descriptionHtml: null, sort: 0 },
    { id: "ps_2", estimateId: "est_1", label: "Foundation done", percent: 30, description: null, descriptionHtml: null, sort: 1, programmeTaskId: "ms1" },
  ] as PaymentScheduleItem[];
  const rows = scheduleToMilestones(schedule, 1_000_000, { projectId: "prj_1", sharedBuildingId: "bld_shared", phaseByTaskId, tasksById });
  assert.equal(rows[0]!["phase"], "General");
  assert.equal(rows[0]!["building_id"], "bld_shared");
  assert.equal(rows[0]!["amount"], 200000);
  assert.equal(rows[0]!["schedule_item_id"], "ps_1");
  assert.equal(rows[1]!["phase"], "Substructure");
  assert.equal(rows[1]!["building_id"], "bld_1");
});

function row(overrides: Partial<PreconBoqRowDto>): PreconBoqRowDto {
  return {
    id: "pbr_1",
    billId: "pbl_1",
    sort: 0,
    rowType: "item",
    elementGroup: "Substructure",
    code: null,
    description: "Concrete in strip foundation",
    unit: "m3",
    qtyGross: 12,
    deductions: [],
    qty: 12,
    rate: null,
    amount: 480000,
    rateSource: null,
    confidence: "high",
    status: "verified",
    version: 1,
    measurementBasis: null,
    verifiedBy: "usr_1",
    verifiedAt: null,
    ...overrides,
  };
}

test("rowsToMaterialOrders dates orders from the matching activity, flags long lead, and honours the job profile", () => {
  const seed = programmeToSeed(PROGRAMME, IDS);
  const tasksById = new Map(PROGRAMME.tasks.map((t) => [t.id, t]));
  const rows = [
    row({}),
    row({ id: "pbr_2", description: "Imported porcelain tiles", elementGroup: "Floor finishings", unit: "m2", qty: 90, amount: null }),
    row({ id: "pbr_3", description: "Rejected line", status: "rejected" }),
    row({ id: "pbr_4", rowType: "heading", description: "SUBSTRUCTURE", qty: null }),
  ];
  const result = rowsToMaterialOrders(rows, {
    projectId: "prj_1",
    currency: "NGN",
    startDate: PROGRAMME.startDate,
    sessionTitle: "Ground floor",
    jobProfile: "labour_only",
    activities: seed.activities,
    tasksById,
    leadTimeByName: new Map([["imported porcelain tiles", 90]]),
  });
  assert.equal(result.orders.length, 2);
  const concrete = result.orders[0]!;
  assert.equal(concrete["needed_by"], "2026-09-15");
  assert.equal(concrete["owner"], "client");
  assert.equal(concrete["status"], "Draft");
  assert.equal(concrete["takeoff_row_id"], "pbr_1");
  assert.equal(concrete["estimated_cost"], 480000);
  const tiles = result.orders[1]!;
  assert.equal(tiles["priority"], "High");
  assert.equal(result.longLeadCount, 1);
});

test("plansToDocuments skips superseded revisions and files current ones under the right discipline", () => {
  const plans = [
    { id: "pp_1", proposalId: "prp", fileId: "f_1", fileName: "GF.pdf", sizeBytes: 2048, mimeType: "application/pdf", label: null, uploadedBy: null, uploadedAt: "", sort: 0, discipline: "structural", revision: "B" },
    { id: "pp_2", proposalId: "prp", fileId: "f_2", fileName: "GF-old.pdf", sizeBytes: 1024, mimeType: "application/pdf", label: null, uploadedBy: null, uploadedAt: "", sort: 1, revisionStatus: "superseded" },
    { id: "pp_3", proposalId: "prp", fileId: "f_3", fileName: "Site.pdf", sizeBytes: 1024, mimeType: "application/pdf", label: null, uploadedBy: null, uploadedAt: "", sort: 2 },
  ] as ProposalPlan[];
  const seed = plansToDocuments(plans, { projectId: "prj_1", uploadedBy: "usr_1", now: "2026-09-15T00:00:00.000Z" });
  assert.equal(seed.documents.length, 2);
  assert.equal(seed.documents[0]!["category_id"], "cat_plan_structural");
  assert.equal(seed.documents[1]!["category_id"], "cat_plan_architectural");
  assert.equal(seed.versions[0]!["revision_label"], "B");
  assert.equal(seed.versions[0]!["document_id"], seed.documents[0]!["id"]);
  assert.equal(seed.documents[0]!["current_version_id"], seed.versions[0]!["id"]);
});

test("areasToSelections makes one open finishes selection per measured space", () => {
  const rows = [row({ elementGroup: "Measured areas", description: "KITCHEN — floor area", unit: "m2", qty: 14.2 }), row({ id: "x" })];
  const selections = areasToSelections(rows, { projectId: "prj_1", currency: "NGN", createdBy: "usr_1" });
  assert.equal(selections.length, 1);
  assert.equal(selections[0]!["title"], "KITCHEN finishes");
  assert.equal(selections[0]!["status"], "open");
});

test("setupFromStructure reads the take-off's structure and programme length instead of a fixed house", () => {
  const setup = setupFromStructure(
    { structureClass: "building", buildingType: "bungalow", storeys: 1, structuralSystem: "load-bearing-masonry", foundationType: "strip", confidence: "high", signals: [] },
    "Lekki",
    programmeWeeks(PROGRAMME.startDate, PROGRAMME.finishDate),
  );
  assert.equal(setup["projectType"], "Residential");
  assert.equal(setup["buildingType"], "Bungalow");
  assert.equal(setup["foundationType"], "strip");
  assert.equal(setup["timeline"], "6 weeks");
  assert.equal(setup["source"], "takeoff-structure");
  assert.equal(setupFromStructure(null, null, null)["source"], "default");
});
