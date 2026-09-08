import { test } from "node:test";
import assert from "node:assert/strict";
import { proposalTemplatesService } from "./templates-service.ts";
import type { ProposalTemplatesRepository } from "./templates-repository.ts";
import type { Estimate, Proposal, ProposalTemplateRow } from "./types.ts";

function templateRow(overrides: Partial<ProposalTemplateRow> = {}): ProposalTemplateRow {
  return {
    id: "ptpl_1",
    org_id: "org_1",
    name: "Residential standard",
    job_profile: "labour_only",
    pack_sections: [{ kind: "exclusions", bodyHtml: "<p>Boundary wall excluded</p>", sort: 0 }],
    payment_schedule: [
      { label: "Advance", percent: 20, description: null, kind: "advance", sort: 0 },
      { label: "Roof on", percent: 80, description: null, kind: "stage", sort: 1 },
    ],
    terms: { retentionPct: 5, whtPct: 2 },
    contingency_pct: 5,
    tax_label: "VAT",
    tax_pct: 7.5,
    created_by: "usr_1",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const proposal = { id: "prop_1", orgId: "org_1", title: "Adeyemi residence" } as Proposal;
const estimate = { id: "est_1", proposalId: "prop_1", revisionNo: 1 } as Estimate;

function fakeRepo(overrides: Partial<Record<keyof ProposalTemplatesRepository, unknown>> = {}): ProposalTemplatesRepository {
  return {
    listByOrg: async () => [templateRow()],
    byId: async () => templateRow(),
    insert: async (row: ProposalTemplateRow) => ({ ...templateRow(), ...row }),
    rename: async (_id: string, name: string) => templateRow({ name }),
    delete: async () => 1,
    snapshotEstimate: async () => ({
      contingencyPct: 5,
      taxLabel: "VAT",
      taxPct: 7.5,
      terms: { retentionPct: 5 },
      schedule: [{ label: "Advance", percent: 100, description: null, kind: "advance", sort: 0 }],
      packSections: [],
    }),
    proposalJobProfile: async () => "labour_only",
    setProposalJobProfile: async () => undefined,
    applyToEstimate: async () => undefined,
    ...overrides,
  } as unknown as ProposalTemplatesRepository;
}

const proposalsRepo = {
  getById: async (id: string, orgId: string) => (id === "prop_1" && orgId === "org_1" ? ({ id } as never) : null),
  getActiveEstimate: async () => estimate,
};

test("saveFromProposal snapshots the estimate's schedule, terms and job profile", async () => {
  let inserted: ProposalTemplateRow | null = null;
  const svc = proposalTemplatesService(
    fakeRepo({
      insert: async (row: ProposalTemplateRow) => {
        inserted = { ...templateRow(), ...row };
        return inserted;
      },
    }),
    proposalsRepo,
    { createProposal: async () => proposal, createEstimateRevision: async () => estimate },
  );
  const tpl = await svc.saveFromProposal("org_1", "usr_1", { proposalId: "prop_1", name: "  Standard  " });
  assert.equal(tpl.name, "Standard");
  assert.equal(tpl.jobProfile, "labour_only");
  assert.equal(inserted!.payment_schedule[0]!.kind, "advance");
  assert.deepEqual(inserted!.terms, { retentionPct: 5 });
  await assert.rejects(svc.saveFromProposal("org_1", "usr_1", { proposalId: "prop_x", name: "x" }), /Proposal/);
  await assert.rejects(svc.saveFromProposal("org_1", "usr_1", { proposalId: "prop_1", name: "   " }), /name/);
});

test("createProposalFromTemplate creates the proposal and revision, then applies the template", async () => {
  const calls: string[] = [];
  const svc = proposalTemplatesService(
    fakeRepo({
      applyToEstimate: async (_p: string, estimateId: string, tpl: ProposalTemplateRow, scheduleIds: string[]) => {
        calls.push(`apply:${estimateId}:${scheduleIds.length}:${tpl.id}`);
      },
      setProposalJobProfile: async (_p: string, profile: string) => {
        calls.push(`profile:${profile}`);
      },
    }),
    proposalsRepo,
    {
      createProposal: async () => {
        calls.push("create");
        return proposal;
      },
      createEstimateRevision: async (_p, _o, _u, opts) => {
        calls.push(`revision:${opts.orgTaxLabel}:${opts.orgTaxPct}`);
        return estimate;
      },
    },
  );
  const result = await svc.createProposalFromTemplate("org_1", "usr_1", {
    templateId: "ptpl_1",
    title: "New job",
    clientName: "Mrs Adeyemi",
  });
  assert.equal(result.proposal.id, "prop_1");
  assert.deepEqual(calls, ["create", "revision:VAT:7.5", "apply:est_1:2:ptpl_1", "profile:labour_only"]);
});

test("templates from another organisation are not found", async () => {
  const svc = proposalTemplatesService(
    fakeRepo({ byId: async () => templateRow({ org_id: "org_2" }) }),
    proposalsRepo,
    { createProposal: async () => proposal, createEstimateRevision: async () => estimate },
  );
  await assert.rejects(svc.rename("org_1", "ptpl_1", "x"), /template/);
  await assert.rejects(
    svc.createProposalFromTemplate("org_1", "usr_1", { templateId: "ptpl_1", title: "t", clientName: "c" }),
    /template/,
  );
});
