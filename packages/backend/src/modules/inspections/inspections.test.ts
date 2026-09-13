import assert from "node:assert/strict";
import { test } from "node:test";
import { contractSideOf } from "../../lib/authorization.ts";
import { PARTICIPANT_PERMISSIONS } from "../../lib/role-presets.ts";
import { inspectionsService } from "./service.ts";
import type { InspectionsRepository } from "./repository.ts";
import type { InspectionActor, InspectionRow } from "./types.ts";

const CLIENT: InspectionActor = { id: "usr_client", name: "Ada Employer", isPlatformAdmin: false };
const INSPECTOR: InspectionActor = { id: "usr_insp", name: "Bee Inspector", isPlatformAdmin: false };
const CONTRACTOR: InspectionActor = { id: "usr_pm", name: "Cal Builder", isPlatformAdmin: false };
const PLATFORM: InspectionActor = { id: "usr_bp", name: "BuildPanda Ops", isPlatformAdmin: true };

function row(over: Partial<InspectionRow> = {}): InspectionRow {
  return {
    id: "insp_1",
    project_id: "prj_1",
    inspector_id: "person_1",
    inspector_name: "Bee Inspector",
    inspector_role: "BuildPanda Inspector",
    inspector_initials_tone: "brand",
    inspector_avatar_url: null,
    inspector_user_id: "usr_insp",
    title: "Formation level, ch 0+420",
    category: "Structural",
    description: "Formation approval before sub-base",
    description_html: null,
    status: "Scheduled",
    service_status: "Scheduled",
    risk_level: "Low",
    scheduled_at: "2026-10-01T09:00:00.000Z",
    activity_id: null,
    location: "ch 0+420",
    hold_point: true,
    outcome: null,
    findings: null,
    reinspection_date: null,
    inspected_at: null,
    inspected_by_id: null,
    inspected_by_name: null,
    requested_by_id: "usr_client",
    requested_by_side: "client",
    contractor_name: "Precon QA Builders Ltd",
    report_issued_at: null,
    fee_amount: "75000.00",
    fee_currency: "NGN",
    report_url: null,
    created_at: new Date("2026-09-20T10:00:00.000Z"),
    ...over,
  };
}

interface FakeState {
  rows: InspectionRow[];
  media: never[];
  deleted: string[];
  attached: { projectId: string; userId: string }[];
  users: Map<string, { id: string; name: string | null; email: string }>;
}

function fakeRepository(state: FakeState): InspectionsRepository {
  return {
    listByProject: async (projectId: string) =>
      state.rows.filter((r) => r.project_id === projectId),
    findById: async (id: string) => state.rows.find((r) => r.id === id),
    projectOwnerId: async () => "usr_owner",
    projectSubject: async () => ({
      owner_id: "usr_owner",
      contractor_entity: "Precon QA Builders Ltd",
      currency: "NGN",
    }),
    userById: async (id: string) => state.users.get(id),
    attachInspectorToProject: async (projectId: string, user: { id: string }) => {
      state.attached.push({ projectId, userId: user.id });
    },
    mediaForInspections: async () => [],
    create: async (record: Partial<InspectionRow>) => {
      const created = row(record);
      state.rows.push(created);
      return created;
    },
    update: async (id: string, patch: Partial<InspectionRow>) => {
      const target = state.rows.find((r) => r.id === id);
      if (!target) return undefined;
      Object.assign(target, patch);
      return target;
    },
    addMedia: async () => undefined,
    maxMediaOrder: async () => 0,
    activityProgress: async () => undefined,
    adminList: async () => [],
    adminCount: async () => 0,
    adminFindById: async (id: string) => {
      const found = state.rows.find((r) => r.id === id);
      return found
        ? {
            ...found,
            project_name: "Ogudu Road",
            organization_id: "org_1",
            organization_name: "Precon QA Builders",
            requested_by_name: "Ada Employer",
            inspector_user_name: state.users.get(found.inspector_user_id ?? "")?.name ?? null,
          }
        : undefined;
    },
    deleteInspection: async (id: string) => {
      state.deleted.push(id);
      state.rows = state.rows.filter((r) => r.id !== id);
    },
  } as unknown as InspectionsRepository;
}

function build(rows: InspectionRow[] = [row()]) {
  const state: FakeState = {
    rows,
    media: [],
    deleted: [],
    attached: [],
    users: new Map([
      ["usr_insp", { id: "usr_insp", name: "Bee Inspector", email: "bee@buildpanda.io" }],
    ]),
  };
  return { state, service: inspectionsService(fakeRepository(state)) };
}

// --- Requesting ------------------------------------------------------------

test("a client requests the service and the contractor is recorded as its subject", async () => {
  const { state, service } = build([]);
  const created = await service.request(
    "prj_1",
    {
      title: "Formation level",
      category: "Structural",
      description: "Before sub-base",
      scheduledAt: "2026-10-01T09:00:00.000Z",
    },
    CLIENT,
    "client",
  );
  assert.equal(created.serviceStatus, "Requested");
  assert.equal(created.requestedById, "usr_client");
  assert.equal(created.requestedBySide, "client");
  assert.equal(created.contractorName, "Precon QA Builders Ltd");
  assert.equal(created.inspectorUserId, null);
  assert.equal(state.rows[0]!.inspector_name, "Pending assignment");
});

test("a third-party builder with no account is named on the request", async () => {
  const { service } = build([]);
  const created = await service.request(
    "prj_1",
    {
      title: "Roof structure",
      category: "Structural",
      description: "Third-party contractor",
      scheduledAt: "2026-10-01T09:00:00.000Z",
      contractorName: "  Someone Else Construction  ",
      feeAmount: 50000,
      feeCurrency: "NGN",
    },
    CLIENT,
    "client",
  );
  assert.equal(created.contractorName, "Someone Else Construction");
  // The fee is a figure we RECORD; nothing is charged.
  assert.equal(created.feeAmount, 50000);
  assert.equal(created.feeCurrency, "NGN");
});

test("the client preset can request an inspection and the Resident Engineer can too", () => {
  assert.ok(PARTICIPANT_PERMISSIONS["client"]?.["inspections"]?.includes("request"));
  assert.ok(PARTICIPANT_PERMISSIONS["resident_engineer"]?.["inspections"]?.includes("request"));
});

test("a contractor-side participant reads inspections but never records them", () => {
  const siteAgent = PARTICIPANT_PERMISSIONS["site_agent"]?.["inspections"] ?? [];
  assert.ok(siteAgent.includes("view"));
  assert.equal(contractSideOf("site_agent"), "contractor");
  assert.equal(contractSideOf("client"), "client");
  // A consultant acts for the employer; workspace staff with no participant
  // role are the party doing the building.
  assert.equal(contractSideOf("resident_engineer"), "client");
  assert.equal(contractSideOf("architect"), "client");
  assert.equal(contractSideOf(undefined), "contractor");
});

// --- Independence ----------------------------------------------------------

test("the contractor cannot record the outcome of an inspection of its own work", async () => {
  const { service } = build();
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, CONTRACTOR),
    /independent of whoever is building/i,
  );
});

test("the client who asked for the inspection cannot record it either", async () => {
  const { service } = build();
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, CLIENT),
    /assigned to this inspection/i,
  );
});

test("nothing can be recorded before BuildPanda assigns an inspector", async () => {
  const { service } = build([row({ inspector_user_id: null, service_status: "Requested" })]);
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, CONTRACTOR),
    /no buildpanda inspector has been assigned/i,
  );
});

test("the assigned inspector records a pass and the report is issued", async () => {
  const { service } = build();
  const reported = await service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, INSPECTOR);
  assert.equal(reported.outcome, "pass");
  assert.equal(reported.status, "Completed");
  assert.equal(reported.serviceStatus, "Reported");
  assert.ok(reported.reportIssuedAt);
  assert.equal(reported.inspectedByName, "Bee Inspector");
});

test("a platform admin can record on the assigned inspector's behalf", async () => {
  const { service } = build();
  const reported = await service.recordOutcome(
    "prj_1",
    "insp_1",
    { outcome: "fail", findings: "Soft spots at ch 0+460", reinspectionDate: "2026-10-08" },
    PLATFORM,
  );
  assert.equal(reported.status, "Action Required");
  assert.equal(reported.serviceStatus, "Reported");
  // The re-inspection date IS the new scheduled date (finding F45).
  assert.equal(reported.scheduledAt, "2026-10-08");
  assert.equal(reported.reinspectionDate, "2026-10-08");
});

test("a fail with no findings is refused even from the assigned inspector", async () => {
  const { service } = build();
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "fail" }, INSPECTOR),
    /needs findings/i,
  );
});

test("the contractor cannot mark an inspection Completed through the edit route", async () => {
  const { service } = build();
  await assert.rejects(
    service.edit("prj_1", "insp_1", { status: "Completed" }, CONTRACTOR),
    /independent of whoever is building/i,
  );
});

test("the contractor may still correct the request's own details", async () => {
  const { service } = build();
  const edited = await service.edit(
    "prj_1",
    "insp_1",
    { location: "ch 0+430", scheduledAt: "2026-10-02T09:00:00.000Z" },
    CONTRACTOR,
  );
  assert.equal(edited.location, "ch 0+430");
  assert.equal(edited.scheduledAt, "2026-10-02T09:00:00.000Z");
});

test("only the assigned inspector marks a visit attended", async () => {
  const { service } = build();
  await assert.rejects(service.markAttended("prj_1", "insp_1", CLIENT), /assigned/i);
  const attended = await service.markAttended("prj_1", "insp_1", INSPECTOR);
  assert.equal(attended.serviceStatus, "Attended");
});

// --- Cancelling ------------------------------------------------------------

test("the requester cancels their own service order", async () => {
  const { service } = build();
  const cancelled = await service.cancel("prj_1", "insp_1", CLIENT);
  assert.equal(cancelled.serviceStatus, "Cancelled");
});

test("the party being inspected cannot cancel the inspection", async () => {
  const { service } = build();
  await assert.rejects(
    service.cancel("prj_1", "insp_1", CONTRACTOR),
    /only the person who requested this inspection/i,
  );
});

test("BuildPanda can cancel a request on the client's behalf", async () => {
  const { service } = build();
  const cancelled = await service.cancel("prj_1", "insp_1", PLATFORM);
  assert.equal(cancelled.serviceStatus, "Cancelled");
});

test("an issued report cannot be cancelled away", async () => {
  const { service } = build([row({ service_status: "Reported" })]);
  await assert.rejects(service.cancel("prj_1", "insp_1", CLIENT), /cannot be cancelled/i);
});

test("a cancelled inspection cannot then be reported on", async () => {
  const { service } = build([row({ service_status: "Cancelled" })]);
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, INSPECTOR),
    /cancelled/i,
  );
});

test("an issued report is a record and is not deleted by the project team", async () => {
  const { state, service } = build([row({ service_status: "Reported" })]);
  await assert.rejects(service.remove("prj_1", "insp_1", CONTRACTOR), /cannot be deleted/i);
  assert.deepEqual(state.deleted, []);
});

// --- Assignment ------------------------------------------------------------

test("assigning a BuildPanda inspector schedules the request", async () => {
  const { service } = build([row({ inspector_user_id: null, service_status: "Requested" })]);
  const summary = await service.assignInspector(
    "insp_1",
    { inspectorUserId: "usr_insp", scheduledAt: "2026-10-05T08:00:00.000Z" },
    PLATFORM,
  );
  assert.equal(summary.serviceStatus, "Scheduled");
  assert.equal(summary.inspectorUserId, "usr_insp");
  assert.equal(summary.inspectorName, "Bee Inspector");
  assert.equal(summary.scheduledAt, "2026-10-05T08:00:00.000Z");
});

test("assignment also puts the inspector on the project so they can open the job", async () => {
  const { state, service } = build([row({ inspector_user_id: null, service_status: "Requested" })]);
  await service.assignInspector("insp_1", { inspectorUserId: "usr_insp" }, PLATFORM);
  assert.deepEqual(state.attached, [{ projectId: "prj_1", userId: "usr_insp" }]);
});

test("only BuildPanda assigns the inspector", async () => {
  const { service } = build([row({ inspector_user_id: null, service_status: "Requested" })]);
  await assert.rejects(
    service.assignInspector("insp_1", { inspectorUserId: "usr_insp" }, CONTRACTOR),
    /only buildpanda can assign an inspector/i,
  );
});

test("assignment is what grants the right to record", async () => {
  const { service } = build([row({ inspector_user_id: null, service_status: "Requested" })]);
  await assert.rejects(
    service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, INSPECTOR),
    /no buildpanda inspector/i,
  );
  await service.assignInspector("insp_1", { inspectorUserId: "usr_insp" }, PLATFORM);
  const reported = await service.recordOutcome("prj_1", "insp_1", { outcome: "pass" }, INSPECTOR);
  assert.equal(reported.serviceStatus, "Reported");
});

test("an inspection on another project is a 404, not someone else's record", async () => {
  const { service } = build();
  await assert.rejects(
    service.recordOutcome("prj_other", "insp_1", { outcome: "pass" }, INSPECTOR),
    /not found/i,
  );
});
