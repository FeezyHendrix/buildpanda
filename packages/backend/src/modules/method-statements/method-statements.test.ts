import { test } from "node:test";
import assert from "node:assert/strict";
import { methodStatementsService } from "./service.ts";
import type {
  MethodStatementPatch,
  MethodStatementsRepository,
  NewMethodStatementRecord,
  NewPhasePlanRecord,
  PhasePlanPatch,
} from "./repository.ts";
import type { MethodStatementRow, PhasePlanRow, SafetyScope } from "./types.ts";
import { highRiskTasks, methodStatementDraftSchema } from "./safety-draft.ts";

function statementRow(overrides: Partial<MethodStatementRow> = {}): MethodStatementRow {
  return {
    id: "mst_1",
    proposal_id: "prp_1",
    project_id: null,
    activity_name: "Excavation for strip foundations",
    programme_task_id: "ppt_1",
    activity_id: null,
    hazards: ["Collapse of trench sides"],
    steps: [{ order: 1, text: "Set out and mark services", controls: "CAT scan", ppe: "Boots, hi-vis" }],
    origin: "ai",
    status: "draft",
    confirmed_by: null,
    confirmed_at: null,
    created_by: "usr_1",
    created_at: new Date("2026-09-01T00:00:00Z"),
    updated_at: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepo(statements: MethodStatementRow[], plans: PhasePlanRow[] = []): MethodStatementsRepository {
  const inScope = (r: { proposal_id: string | null; project_id: string | null }, scope: { proposalId?: string; projectId?: string }) =>
    scope.proposalId ? r.proposal_id === scope.proposalId : r.project_id === scope.projectId;
  return {
    listByScope: async (scope: SafetyScope) => statements.filter((s) => inScope(s, scope)),
    findById: async (id: string) => statements.find((s) => s.id === id),
    insert: async (record: NewMethodStatementRecord) => {
      const created = statementRow({ ...record, confirmed_by: null, confirmed_at: null, created_at: new Date(), updated_at: new Date() });
      statements.push(created);
      return created;
    },
    insertMany: async (records: NewMethodStatementRecord[]) => {
      const created = records.map((record) =>
        statementRow({ ...record, confirmed_by: null, confirmed_at: null, created_at: new Date(), updated_at: new Date() }),
      );
      statements.push(...created);
      return created;
    },
    update: async (id: string, patch: MethodStatementPatch) => {
      const index = statements.findIndex((s) => s.id === id);
      if (index === -1) return undefined;
      statements[index] = { ...statements[index]!, ...(patch as Partial<MethodStatementRow>), updated_at: new Date() };
      return statements[index];
    },
    remove: async (id: string) => {
      const index = statements.findIndex((s) => s.id === id);
      if (index !== -1) statements.splice(index, 1);
    },
    phasePlanByScope: async (scope: SafetyScope) => plans.find((p) => inScope(p, scope)),
    insertPhasePlan: async (record: NewPhasePlanRecord) => {
      const created = { ...record, confirmed_by: null, confirmed_at: null, created_at: new Date(), updated_at: new Date() } as PhasePlanRow;
      plans.push(created);
      return created;
    },
    updatePhasePlan: async (id: string, patch: PhasePlanPatch) => {
      const index = plans.findIndex((p) => p.id === id);
      if (index === -1) return undefined;
      plans[index] = { ...plans[index]!, ...(patch as Partial<PhasePlanRow>), updated_at: new Date() };
      return plans[index];
    },
  } as unknown as MethodStatementsRepository;
}

test("high-risk tasks are picked by keyword, once each", () => {
  const picked = highRiskTasks(["Excavation for footings", "Blockwork to lintel", "Roof structure", "excavation for footings", "Electrical first fix"]);
  assert.deepEqual(picked, ["Excavation for footings", "Roof structure", "Electrical first fix"]);
});

test("draft schema rejects unknown fields and accepts the documented shape", () => {
  assert.equal(methodStatementDraftSchema.safeParse({ statements: [{ activityName: "x", extra: 1 }] }).success, false);
  const ok = methodStatementDraftSchema.safeParse({
    statements: [{ activityName: "Roof structure", hazards: ["Fall from height"], steps: [{ text: "Erect scaffold", controls: "Tagged", ppe: "Harness" }, { text: "Fix trusses", controls: "Two-man lift", ppe: "Gloves" }] }],
  });
  assert.equal(ok.success, true);
});

test("editing a draft marks it edited; editing a confirmed statement reopens it; confirm stamps the actor", async () => {
  const store = [statementRow()];
  const svc = methodStatementsService(fakeRepo(store));
  const edited = await svc.edit({ proposalId: "prp_1" }, "mst_1", { hazards: ["Collapse", "Buried services"] });
  assert.equal(edited.status, "edited");
  const confirmed = await svc.confirm({ proposalId: "prp_1" }, "mst_1", "usr_9");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.confirmedBy, "usr_9");
  const reopened = await svc.edit({ proposalId: "prp_1" }, "mst_1", { steps: [{ order: 5, text: "New step", controls: "", ppe: "" }] });
  assert.equal(reopened.status, "edited");
  assert.equal(reopened.confirmedBy, null);
  assert.equal(reopened.steps[0]!.order, 1);
  await assert.rejects(svc.edit({ projectId: "proj_1" }, "mst_1", { hazards: [] }), /not found/i);
});

test("draft only covers high-risk programme tasks without a statement and links the task id", async () => {
  const store = [statementRow({ activity_name: "Excavation for footings" })];
  const svc = methodStatementsService(fakeRepo(store), {
    draft: async () =>
      ({
        data: {
          statements: [
            { activityName: "Roof structure", hazards: ["Fall"], steps: [{ text: "a", controls: "b", ppe: "c" }, { text: "d", controls: "", ppe: "" }] },
            { activityName: "Blockwork", hazards: ["x"], steps: [{ text: "a", controls: "", ppe: "" }, { text: "b", controls: "", ppe: "" }] },
          ],
        },
      }) as never,
  });
  const drafted = await svc.draft(
    { proposalId: "prp_1" },
    { title: "T", brief: null, location: null, structure: null, programmeTasks: ["Excavation for footings", "Roof structure", "Blockwork"], programmeTaskIds: { "Roof structure": "ppt_7" } },
    "usr_1",
  );
  assert.equal(drafted.length, 1);
  assert.equal(drafted[0]!.activityName, "Roof structure");
  assert.equal(drafted[0]!.programmeTaskId, "ppt_7");
  assert.equal(drafted[0]!.status, "draft");
  await assert.rejects(
    svc.draft({ proposalId: "prp_1" }, { title: "T", brief: null, location: null, structure: null, programmeTasks: ["Painting"], programmeTaskIds: {} }, "usr_1"),
    /No high-risk/,
  );
});

test("phase plan upserts as edited, confirms, and drafting resets to an AI draft", async () => {
  const plans: PhasePlanRow[] = [];
  const svc = methodStatementsService(fakeRepo([], plans), {
    draft: async () => ({ data: { keyDatesNote: "k", siteRules: "s", welfare: "w", firstAid: "f", servicesIsolation: "i", asbestosNote: "a", hazards: ["h"], supervision: "sup" } }) as never,
  });
  assert.equal(await svc.getPhasePlan({ proposalId: "prp_1" }), null);
  const created = await svc.upsertPhasePlan({ proposalId: "prp_1" }, { siteRules: "No smoking" });
  assert.equal(created.status, "edited");
  const confirmed = await svc.confirmPhasePlan({ proposalId: "prp_1" }, "usr_2");
  assert.equal(confirmed.status, "confirmed");
  const drafted = await svc.draftPhasePlan({ proposalId: "prp_1" }, { title: "T", brief: null, location: null, structure: null, programmeTasks: [], programmeTaskIds: {} });
  assert.equal(drafted.status, "draft");
  assert.equal(drafted.origin, "ai");
  assert.equal(drafted.siteRules, "s");
});

test("carryToProject copies confirmed statements and the plan once", async () => {
  const store = [statementRow({ id: "a", status: "confirmed" }), statementRow({ id: "b" })];
  const plans: PhasePlanRow[] = [{ id: "cpp_1", proposal_id: "prp_1", project_id: null, key_dates_note: null, site_rules: "r", welfare: null, first_aid: null, services_isolation: null, asbestos_note: null, hazards: [], supervision: null, emergency_contacts: [], origin: "manual", status: "edited", confirmed_by: null, confirmed_at: null, created_at: new Date(), updated_at: new Date() }];
  const svc = methodStatementsService(fakeRepo(store, plans));
  const result = await svc.carryToProject("prp_1", "proj_1");
  assert.deepEqual(result, { statements: 1, phasePlan: true });
  const again = await svc.carryToProject("prp_1", "proj_1");
  assert.equal(again.phasePlan, false);
});
