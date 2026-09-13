import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCreate } from "./create.ts";
import { toProjectTypeCode } from "./project-type.ts";
import { projectsService } from "./service.ts";
import type { ProjectsRepository } from "./repository.ts";
import type { CreateProjectInput, ProjectRow } from "./types.ts";

function input(projectType: string, templateId?: string): CreateProjectInput {
  return {
    title: "Ikorodu–Sagamu Link Road",
    projectType,
    ...(templateId ? { templateId } : {}),
    location: { state: "Lagos", city: "Ikorodu", ownsLand: true },
    details: {
      buildingType: "road",
      currency: "NGN",
      budgetMin: 850000000,
      budgetMax: 850000000,
      timeline: "29 weeks",
      fundingMethod: "contract",
    },
    management: { involvementLevel: "daily", riskOptions: [] },
  };
}

test("a road job is a civil project, not a house", () => {
  assert.equal(toProjectTypeCode("civil"), "civil");
  assert.equal(toProjectTypeCode("Road / infrastructure"), "civil");
  assert.equal(toProjectTypeCode("renovate"), "renovation");
  assert.equal(toProjectTypeCode("build"), "building");
  assert.equal(toProjectTypeCode("something else"), "other");
});

test("start blank seeds no stages — blank means blank", () => {
  assert.deepEqual(buildCreate(input("civil"), "usr_1", null).phases, []);
  assert.deepEqual(buildCreate(input("renovate"), "usr_1", null).phases, []);
});

test("the project records its type so the app knows what kind of works it is", () => {
  assert.equal(buildCreate(input("civil"), "usr_1", null).project.project_type, "civil");
});

test("a chosen template still seeds its stages", () => {
  const { phases } = buildCreate(input("build", "residential-new-build"), "usr_1", null);
  assert.ok(phases.length > 0);
  assert.ok(phases.every((p) => p.building_id !== ""));
});

function projectRow(over: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "prj_1",
    owner_id: "usr_1",
    organization_id: null,
    name: "Link Road",
    address: "Ikorodu, Lagos",
    status: "On Track",
    health_score: 0,
    risk: "Low",
    progress_percent: 0,
    budget_total: "850000000",
    budget_used: "0",
    currency: "NGN",
    pending_approvals: 0,
    next_inspection_type: null,
    next_inspection_date: null,
    folder_tone: "orange",
    budget_min: null,
    budget_max: null,
    setup: null,
    ai_update_cadence: "off",
    start_date: "2026-09-07",
    completion_date: "2027-03-26",
    revised_completion_date: null,
    client_name: null,
    contractor_entity: null,
    project_type: "civil",
    working_days: [1, 2, 3, 4, 5, 6],
    holidays: [],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function build(row = projectRow()) {
  const patches: Record<string, unknown>[] = [];
  const repository = {
    findById: async () => row,
    findPhasesByProject: async () => [],
    update: async (_id: string, patch: Record<string, unknown>) => {
      patches.push(patch);
      Object.assign(row, patch);
    },
  } as unknown as ProjectsRepository;
  return { row, patches, service: projectsService(repository) };
}

test("the profile exposes the contract dates and the working calendar", async () => {
  const { service } = build();
  const profile = await service.getProfile("prj_1");
  assert.equal(profile.startDate, "2026-09-07");
  assert.equal(profile.completionDate, "2027-03-26");
  assert.deepEqual(profile.workingDays, [1, 2, 3, 4, 5, 6]);
});

test("a completion date before the start date is refused", async () => {
  const { service } = build();
  await assert.rejects(
    service.updateProfile("prj_1", { completionDate: "2026-09-01" }),
    /Completion date must be on or after the start date/i,
  );
});

test("the working week is stored sorted and de-duplicated", async () => {
  const { patches, service } = build();
  await service.updateProfile("prj_1", { workingDays: [5, 1, 1, 3] });
  assert.equal(patches[0]!.working_days, JSON.stringify([1, 3, 5]));
});

test("a week with no working days is refused — it would stop every duration", async () => {
  const { service } = build();
  await assert.rejects(service.updateProfile("prj_1", { workingDays: [] }), /at least one working day/i);
});

test("holidays are stored as json", async () => {
  const { patches, service } = build();
  await service.updateProfile("prj_1", { holidays: ["2026-10-01"] });
  assert.equal(patches[0]!.holidays, JSON.stringify(["2026-10-01"]));
});

test("the client and contractor are recorded on the project, not guessed", async () => {
  const { service } = build();
  const profile = await service.updateProfile("prj_1", {
    clientName: "Lagos State Ministry of Works",
    contractorEntity: "Precon QA Builders Ltd",
  });
  assert.equal(profile.clientName, "Lagos State Ministry of Works");
  assert.equal(profile.contractorEntity, "Precon QA Builders Ltd");
});
