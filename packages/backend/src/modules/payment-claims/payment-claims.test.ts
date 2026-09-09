import { test } from "node:test";
import assert from "node:assert/strict";
import { computeClaimDeductions } from "./deductions.ts";
import { paymentClaimsService } from "./service.ts";
import type { PaymentClaimsRepository } from "./repository.ts";
import type { PaymentClaimRow } from "./types.ts";

// Worked example from the design brief (screen S7): foundation and DPC
// milestone certified at ₦12,075,000 on a contract with 5 % retention, a 20 %
// advance recovered pro-rata, 7.5 % VAT and 2 % withholding tax.
test("computeClaimDeductions matches the brief's worked example", () => {
  const d = computeClaimDeductions(12_075_000, {
    retentionRate: 0.05,
    advanceRate: 0.2,
    advanceTotal: 9_660_000,
    advanceRecovered: 0,
    vatPct: 7.5,
    whtPct: 2,
  });
  assert.equal(d.retention, 603_750);
  assert.equal(d.advanceRecovery, 2_415_000);
  assert.equal(d.net, 9_056_250);
  assert.equal(d.vat, 679_218.75);
  assert.equal(d.invoice, 9_735_468.75);
  assert.equal(d.wht, 181_125);
});

test("advance recovery stops once the advance is fully recovered", () => {
  const d = computeClaimDeductions(10_000_000, {
    retentionRate: 0,
    advanceRate: 0.2,
    advanceTotal: 1_500_000,
    advanceRecovered: 1_000_000,
    vatPct: 0,
    whtPct: 0,
  });
  assert.equal(d.advanceRecovery, 500_000);
  assert.equal(d.invoice, 9_500_000);
});

function claimRow(overrides: Partial<PaymentClaimRow> = {}): PaymentClaimRow {
  return {
    id: "pc_1",
    project_id: "prj_1",
    milestone_payment_id: "ms_1",
    claim_number: "PC-001",
    period_start: null,
    period_end: null,
    amount: "12075000.00",
    status: "Submitted",
    submitted_at: "2026-09-08T00:00:00Z",
    approved_at: null,
    notes: null,
    retention_amount: null,
    advance_recovery_amount: null,
    vat_amount: null,
    wht_amount: null,
    invoice_amount: null,
    invoice_number: null,
    invoice_recorded_at: null,
    invoice_recorded_by: null,
    created_at: new Date("2026-09-08T00:00:00Z"),
    ...overrides,
  };
}

function fakeRepo(overrides: Partial<Record<keyof PaymentClaimsRepository, unknown>> = {}): PaymentClaimsRepository {
  let current = claimRow();
  return {
    listByProject: async () => [current],
    findById: async () => current,
    create: async (record: PaymentClaimRow) => record,
    update: async (_id: string, patch: Partial<PaymentClaimRow>) => {
      current = { ...current, ...patch };
      return current;
    },
    deleteClaim: async () => 1,
    openClaimForMilestone: async () => undefined,
    billingContext: async () => ({
      retentionRate: 0.05,
      advanceRate: 0.2,
      advanceTotal: 9_660_000,
      advanceRecovered: 0,
      vatPct: 7.5,
      whtPct: 2,
    }),
    ...overrides,
  } as unknown as PaymentClaimsRepository;
}

test("approving a claim stores its deductions and marks the milestone claimed→certified on invoice", async () => {
  const states: string[] = [];
  const certifications: number[] = [];
  const svc = paymentClaimsService(fakeRepo(), {
    setMilestoneClaimState: async (_p, _m, state) => {
      states.push(state);
    },
    recordCertification: async (_p, input) => {
      certifications.push(input.certified);
    },
    recordClaimPayment: async () => undefined,
  });
  const approved = await svc.edit("prj_1", "pc_1", { status: "Approved" });
  assert.equal(approved.retentionAmount, 603_750);
  assert.equal(approved.invoiceAmount, 9_735_468.75);
  assert.equal(approved.whtAmount, 181_125);

  const invoiced = await svc.recordInvoice("prj_1", "pc_1", { invoiceNumber: "INV-0042" }, { id: "usr_1", name: "QS" });
  assert.equal(invoiced.invoiceNumber, "INV-0042");
  assert.ok(invoiced.invoiceRecordedAt);
  // approval marks the milestone claimed; the recorded invoice certifies it
  assert.deepEqual(states, ["claimed", "certified"]);
  assert.deepEqual(certifications, [12_075_000]);
});

test("recordInvoice refuses a claim that is not approved", async () => {
  const svc = paymentClaimsService(fakeRepo({ findById: async () => claimRow({ status: "Draft" }) }));
  await assert.rejects(svc.recordInvoice("prj_1", "pc_1", { invoiceNumber: "X" }, { id: "u", name: "n" }), /approved/i);
});

test("a milestone can only carry one open claim", async () => {
  const svc = paymentClaimsService(
    fakeRepo({ openClaimForMilestone: async () => claimRow({ id: "pc_other", status: "Submitted" }) }),
  );
  await assert.rejects(
    svc.create("prj_1", { milestonePaymentId: "ms_1", claimNumber: "PC-002", amount: 1 }),
    /already has an open claim/i,
  );
});
