import { test } from "node:test";
import assert from "node:assert/strict";
import { contractTermsPatch, toContractTerms } from "./contract-terms.ts";
import type { FinancesRow } from "./types.ts";

function row(over: Partial<FinancesRow> = {}): FinancesRow {
  return {
    contract_type: "unit_rate",
    retention_rate: "0.05",
    retention_release_mode: "staged_pc_dlp",
    retention_cap_percent: "0.025",
    advance_percentage: "0.1",
    advance_recovery_mode: "percentage",
    advance_recovery_rate: "0.1",
    advance_recovery_from_certificate: 2,
    payment_terms_days: 14,
    defects_liability_days: 365,
    defects_period_months: 12,
    vat_rate: "0.075",
    liquidated_damages_rate: "500000",
    liquidated_damages_cap_percent: "0.1",
    commencement_date: "2026-09-07",
    completion_date: "2027-03-26",
    employer_name: "Lagos State Ministry of Works",
    contractor_name: "Precon QA Builders",
    contract_form: "fidic_red",
    valuation_frequency: "monthly",
    contract_notes: null,
    ...over,
  } as FinancesRow;
}

test("every rate on the DTO is a fraction — neighbours never disagree by 100x", () => {
  const terms = toContractTerms(row());
  assert.equal(terms.retentionRate, 0.05);
  // This one used to be stored as 10 for 10% next to a retention rate of 0.05.
  assert.equal(terms.advanceRecoveryRate, 0.1);
  assert.equal(terms.vatRate, 0.075);
  assert.equal(terms.retentionCapPercent, 0.025);
  assert.equal(terms.liquidatedDamagesCapPercent, 0.1);
  // The only money-per-day figure on the terms.
  assert.equal(terms.liquidatedDamagesRate, 500_000);
});

test("the parties, the form, the period and the LD terms are all recorded fields", () => {
  const terms = toContractTerms(row());
  assert.equal(terms.employerName, "Lagos State Ministry of Works");
  assert.equal(terms.contractorName, "Precon QA Builders");
  assert.equal(terms.contractForm, "fidic_red");
  assert.equal(terms.commencementDate, "2026-09-07");
  assert.equal(terms.completionDate, "2027-03-26");
  assert.equal(terms.advanceRecoveryFromCertificate, 2);
  assert.equal(terms.valuationFrequency, "monthly");
  // Contracts express defects liability in months, not days.
  assert.equal(terms.defectsPeriodMonths, 12);
});

test("a percentage sent where a fraction belongs is refused, never silently divided", () => {
  assert.throws(
    () => contractTermsPatch({ advanceRecoveryRate: 10 }),
    /fraction between 0 and 1 \(0.05 for 5%\)/,
  );
  assert.throws(() => contractTermsPatch({ retentionRate: 5 }), /fraction between 0 and 1/);
  assert.throws(() => contractTermsPatch({ vatRate: 7.5 }), /fraction between 0 and 1/);
  assert.deepEqual(contractTermsPatch({ advanceRecoveryRate: 0.1 }), { advance_recovery_rate: 0.1 });
});

test("recovery cannot start before the first certificate", () => {
  assert.throws(
    () => contractTermsPatch({ advanceRecoveryFromCertificate: 0 }),
    /from certificate 1 or later/,
  );
  assert.deepEqual(contractTermsPatch({ advanceRecoveryFromCertificate: 2 }), {
    advance_recovery_from_certificate: 2,
  });
});

test("defects liability stays consistent whichever unit it is set in", () => {
  assert.deepEqual(contractTermsPatch({ defectsPeriodMonths: 12 }), {
    defects_period_months: 12,
    defects_liability_days: 360,
  });
  assert.deepEqual(contractTermsPatch({ defectsLiabilityDays: 365 }), {
    defects_liability_days: 365,
    defects_period_months: 12,
  });
});

test("a completion date before commencement is refused", () => {
  assert.throws(
    () => contractTermsPatch({ commencementDate: "2026-09-07", completionDate: "2026-09-01" }),
    /cannot fall before commencement/,
  );
});

test("an unknown contract form is refused, and clearing it is allowed", () => {
  assert.throws(() => contractTermsPatch({ contractForm: "fidic_purple" }), /Unknown contract form/);
  assert.deepEqual(contractTermsPatch({ contractForm: "  " }), { contract_form: null });
  assert.deepEqual(contractTermsPatch({ contractForm: "nec" }), { contract_form: "nec" });
});

test("liquidated damages are a money rate per day, and the cap is a fraction", () => {
  assert.deepEqual(
    contractTermsPatch({ liquidatedDamagesRate: 500_000, liquidatedDamagesCapPercent: 0.1 }),
    { liquidated_damages_rate: 500_000, liquidated_damages_cap_percent: 0.1 },
  );
  assert.throws(() => contractTermsPatch({ liquidatedDamagesRate: -1 }), /cannot be negative/);
  assert.throws(() => contractTermsPatch({ liquidatedDamagesCapPercent: 10 }), /fraction between 0 and 1/);
});
