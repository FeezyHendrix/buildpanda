import { test } from "node:test";
import assert from "node:assert/strict";
import { riskScore, risksService, severityForScore, toRiskFactor } from "./service.ts";
import type { RisksRepository, NewRiskFactorRecord, RiskFactorUpdatePatch } from "./repository.ts";
import type { RiskFactorRow } from "./types.ts";
import { riskDraftSchema } from "./risk-draft.ts";

function row(overrides: Partial<RiskFactorRow> = {}): RiskFactorRow {
  return {
    id: "risk_1",
    project_id: null,
    proposal_id: "prp_1",
    title: "Flooding of excavation",
    description: "Site is low-lying; rainy season starts in the programme window.",
    description_html: null,
    severity: "High",
    likelihood: "high",
    impact: "medium",
    owner_id: null,
    owner_name: null,
    mitigation: "Dewatering pump on site before excavation.",
    status: "open",
    review_date: null,
    origin: "ai",
    confirmed_by: null,
    confirmed_at: null,
    created_at: new Date("2026-09-01T00:00:00Z"),
    updated_at: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepo(store: RiskFactorRow[]): RisksRepository {
  return {
    listByProject: async (projectId: string) => store.filter((r) => r.project_id === projectId),
    listByProposal: async (proposalId: string) => store.filter((r) => r.proposal_id === proposalId),
    findById: async (id: string) => store.find((r) => r.id === id),
    create: async (record: NewRiskFactorRecord) => {
      const created = row({ ...record, created_at: new Date(), updated_at: new Date() });
      store.push(created);
      return created;
    },
    createMany: async (records: NewRiskFactorRecord[]) => {
      const created = records.map((record) => row({ ...record, created_at: new Date(), updated_at: new Date() }));
      store.push(...created);
      return created;
    },
    update: async (id: string, patch: RiskFactorUpdatePatch) => {
      const index = store.findIndex((r) => r.id === id);
      if (index === -1) return undefined;
      const { updated_at: _ignored, ...rest } = patch;
      store[index] = { ...store[index]!, ...(rest as Partial<RiskFactorRow>), updated_at: new Date(Date.now() + 5000) };
      return store[index];
    },
    deleteRiskFactor: async (id: string) => {
      const index = store.findIndex((r) => r.id === id);
      if (index !== -1) store.splice(index, 1);
    },
  } as unknown as RisksRepository;
}

test("score is likelihood x impact and severity follows it", () => {
  assert.equal(riskScore("high", "high"), 9);
  assert.equal(riskScore("low", "medium"), 2);
  assert.equal(riskScore(null, "high"), null);
  assert.equal(severityForScore(9), "High");
  assert.equal(severityForScore(6), "High");
  assert.equal(severityForScore(4), "Medium");
  assert.equal(severityForScore(2), "Low");
  assert.equal(severityForScore(null, "Medium"), "Medium");
});

test("an untouched AI row is ai_draft, an edited one is edited, a confirmed one is confirmed", () => {
  assert.equal(toRiskFactor(row()).editState, "ai_draft");
  assert.equal(toRiskFactor(row({ updated_at: new Date("2026-09-02T00:00:00Z") })).editState, "edited");
  assert.equal(toRiskFactor(row({ confirmed_at: new Date(), confirmed_by: "usr_1" })).editState, "confirmed");
  assert.equal(toRiskFactor(row({ origin: "manual" })).editState, "edited");
});

test("editing a confirmed risk clears the confirmation and re-derives severity", async () => {
  const store = [row({ confirmed_at: new Date(), confirmed_by: "usr_1" })];
  const svc = risksService(fakeRepo(store));
  const updated = await svc.editForProposal("prp_1", "risk_1", { likelihood: "low", impact: "low" });
  assert.equal(updated.editState, "edited");
  assert.equal(updated.confirmedBy, null);
  assert.equal(updated.severity, "Low");
  assert.equal(updated.score, 1);
});

test("confirm stamps the actor and scoping is enforced", async () => {
  const store = [row()];
  const svc = risksService(fakeRepo(store));
  const confirmed = await svc.confirm({ proposalId: "prp_1" }, "risk_1", "usr_9");
  assert.equal(confirmed.editState, "confirmed");
  assert.equal(confirmed.confirmedBy, "usr_9");
  await assert.rejects(svc.editForProposal("prp_other", "risk_1", { title: "x" }), /not found/i);
  await assert.rejects(svc.edit("proj_1", "risk_1", { title: "x" }), /not found/i);
});

test("draft validates the model output and rejects unknown fields", async () => {
  const bad = riskDraftSchema.safeParse({ risks: [{ title: "x", bogus: true }] });
  assert.equal(bad.success, false);
  const good = riskDraftSchema.safeParse({
    risks: [{ title: "Late tiles", description: "Imported porcelain has a 10-week lead.", likelihood: "medium", impact: "high", mitigation: "Order at contract signing." }],
  });
  assert.equal(good.success, true);
});

test("draftForProposal inserts AI rows with derived severity and leaves existing rows alone", async () => {
  const store = [row({ id: "risk_existing", origin: "manual" })];
  const svc = risksService(fakeRepo(store), {
    draft: async () =>
      ({
        data: {
          risks: [
            { title: "Late tiles", description: "Imported porcelain has a 10-week lead.", likelihood: "medium", impact: "high", mitigation: "Order at signing." },
          ],
        },
      }) as never,
  });
  const drafted = await svc.draftForProposal("prp_1", { title: "T", brief: null, location: null, structure: null, programmeTasks: [] });
  assert.equal(drafted.length, 1);
  assert.equal(drafted[0]!.origin, "ai");
  assert.equal(drafted[0]!.severity, "High");
  assert.equal(store.length, 2);
});

test("carryToProject copies confirmed rows only when any are confirmed", async () => {
  const store = [
    row({ id: "r1", confirmed_at: new Date(), confirmed_by: "u" }),
    row({ id: "r2" }),
  ];
  const svc = risksService(fakeRepo(store));
  const count = await svc.carryToProject("prp_1", "proj_1");
  assert.equal(count, 1);
  assert.equal(store.filter((r) => r.project_id === "proj_1").length, 1);
  const none = [row({ id: "r3" })];
  assert.equal(await risksService(fakeRepo(none)).carryToProject("prp_1", "proj_2"), 1);
});
