import { test } from "node:test";
import assert from "node:assert/strict";
import { proposalTermsService, sendBlocker, validateSchedule, validateTerms } from "./terms-service.ts";
import type { ProposalsRepository } from "./repository.ts";
import type { ProposalTermsRepository } from "./terms-repository.ts";
import type { Estimate, PaymentScheduleItem } from "./types.ts";

const stage = (label: string, percent: number, kind: "advance" | "stage" = "stage"): PaymentScheduleItem => ({
  id: `s_${label}`,
  estimateId: "est_1",
  label,
  percent,
  description: null,
  descriptionHtml: null,
  sort: 0,
  kind,
  programmeTaskId: null,
});

test("validateSchedule: must total 100 with at most one advance placed first", () => {
  assert.equal(validateSchedule([]), "Add at least one payment stage.");
  assert.match(validateSchedule([stage("Foundation", 60)]) ?? "", /total 100/);
  assert.equal(validateSchedule([stage("Advance", 20, "advance"), stage("Roof", 50), stage("Handover", 30)]), null);
  assert.match(validateSchedule([stage("Roof", 50), stage("Advance", 20, "advance"), stage("Handover", 30)]) ?? "", /first stage/);
  assert.match(validateSchedule([stage("A", 20, "advance"), stage("B", 20, "advance"), stage("C", 60)]) ?? "", /Only one advance/);
  assert.match(validateSchedule([stage("A", 0), stage("B", 100)]) ?? "", /above zero/);
  // floating point sums like 33.33 + 33.33 + 33.34 are accepted
  assert.equal(validateSchedule([stage("A", 33.33), stage("B", 33.33), stage("C", 33.34)]), null);
});

test("validateTerms: bounds and the fixed withholding rates", () => {
  assert.equal(validateTerms({ retentionPct: 5, advancePct: 20, whtPct: 2 }), null);
  assert.match(validateTerms({ retentionPct: 25 }) ?? "", /Retention/);
  assert.match(validateTerms({ advancePct: 60 }) ?? "", /Advance/);
  assert.match(validateTerms({ whtPct: 3 }) ?? "", /Withholding/);
  assert.equal(validateTerms({ whtPct: 0 }), null);
  assert.match(validateTerms({ paymentTermsDays: -1 }) ?? "", /Payment terms/);
});

test("sendBlocker: only a Draft with a complete schedule can be sent", () => {
  const draft = { status: "Draft" } as Estimate;
  assert.match(sendBlocker(draft, []) ?? "", /at least one/);
  assert.equal(sendBlocker(draft, [stage("Advance", 30, "advance"), stage("Handover", 70)]), null);
  assert.match(sendBlocker({ status: "Sent" } as Estimate, [stage("All", 100)]) ?? "", /Only Draft/);
});

function fakeRepos(estimate: Partial<Estimate> = {}) {
  const calls: { terms?: unknown; validUntil?: unknown; schedule?: unknown } = {};
  const est = { id: "est_1", proposalId: "prop_1", status: "Draft", ...estimate } as Estimate;
  const repo = {
    getById: async () => ({ id: "prop_1", org_id: "org_1" }),
    getEstimate: async () => est,
    updateProposal: async (_id: string, _org: string, patch: { validUntil?: string | null }) => {
      calls.validUntil = patch.validUntil;
      return null;
    },
    replaceSchedule: async (_id: string, items: unknown) => {
      calls.schedule = items;
      return [];
    },
    getSchedule: async () => [stage("All", 100)],
  } as unknown as ProposalsRepository;
  const terms = {
    updateTerms: async (_id: string, patch: unknown) => {
      calls.terms = patch;
      return 1;
    },
  } as unknown as ProposalTermsRepository;
  return { repo, terms, calls };
}

test("updateTerms writes estimate terms and forwards validity to the proposal", async () => {
  const { repo, terms, calls } = fakeRepos();
  const svc = proposalTermsService(repo, terms);
  await svc.updateTerms("est_1", "prop_1", "org_1", { retentionPct: 5, whtPct: 2, validUntil: "2026-09-30" });
  assert.deepEqual(calls.terms, { retentionPct: 5, whtPct: 2 });
  assert.equal(calls.validUntil, "2026-09-30");
});

test("updateTerms refuses a revision that is no longer a draft", async () => {
  const { repo, terms } = fakeRepos({ status: "Sent" });
  const svc = proposalTermsService(repo, terms);
  await assert.rejects(svc.updateTerms("est_1", "prop_1", "org_1", { retentionPct: 5 }), /Only Draft/);
});

test("savePaymentSchedule rejects a schedule that does not total 100", async () => {
  const { repo, terms, calls } = fakeRepos();
  const svc = proposalTermsService(repo, terms);
  await assert.rejects(
    svc.savePaymentSchedule("est_1", "prop_1", "org_1", [{ label: "Foundation", percent: 40 }]),
    /total 100/,
  );
  const beforeSave = calls.schedule;
  assert.equal(beforeSave, undefined);
  await svc.savePaymentSchedule("est_1", "prop_1", "org_1", [
    { label: "Advance", percent: 20, kind: "advance" },
    { label: "Handover", percent: 80 },
  ]);
  const saved = calls.schedule as unknown[] | undefined;
  assert.equal(saved?.length, 2);
});
