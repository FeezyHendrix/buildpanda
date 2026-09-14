import { test } from "node:test";
import assert from "node:assert/strict";
import { financeSummaryService, ldExposureFor, stageBudgetLines } from "./finance-summary.ts";
import type { FinanceSummaryRepository } from "./summary-repository.ts";
import type { ContractTerms, FinancesRow } from "./types.ts";

const TODAY = "2026-09-13";

function financesRow(over: Partial<FinancesRow> = {}): FinancesRow {
  return {
    project_id: "prj_1",
    currency: "NGN",
    total_budget: "850000000",
    contract_sum: "850000000",
    variations_total: "4200000",
    certified_gross_to_date: "0",
    amount_paid_to_date: "0",
    contract_type: "unit_rate",
    retention_rate: "0.05",
    retention_release_mode: "staged_pc_dlp",
    advance_percentage: "0.1",
    advance_recovery_mode: "percentage",
    advance_recovery_rate: "0.1",
    advance_recovered: "0",
    payment_terms_days: 14,
    defects_liability_days: 365,
    contract_notes: null,
    retention_held: "0",
    liquidated_damages_rate: "500000",
    liquidated_damages_cap_percent: "0.1",
    commencement_date: "2026-09-07",
    completion_date: "2027-03-26",
    employer_name: "Lagos State Ministry of Works",
    contractor_name: "Precon QA Builders",
    contract_form: "fidic_red",
    vat_rate: "0.075",
    advance_recovery_from_certificate: 2,
    retention_cap_percent: "0",
    valuation_frequency: "monthly",
    defects_period_months: 12,
    funds_deposited: "85000000",
    funds_released: "0",
    ...over,
  } as FinancesRow;
}

function summaryRepo(over: Partial<Record<string, unknown>> = {}): FinanceSummaryRepository {
  return {
    certifiedTotals: async () => ({
      certified: "105187500",
      retention: "1009375",
      advance_recovered: "0",
      certificates: "2",
    }),
    paidTotal: async () => "85000000",
    projectDates: async () => ({ completion_date: "2027-03-26", revised_completion_date: null }),
    eotDays: async () => null,
    ...over,
  } as unknown as FinanceSummaryRepository;
}

test("the waterfall is fed by certificates and receipts, never by funding deposits", async () => {
  const service = financeSummaryService({
    finances: { findSummary: async () => financesRow() },
    summary: summaryRepo(),
    stageCosts: { byProject: async () => ({ stages: [] }) },
    stages: async () => [],
  });
  const position = await service.get("prj_1", TODAY);

  assert.equal(position.adjustedContract, 854_200_000);
  assert.equal(position.certifiedGrossToDate, 105_187_500);
  assert.equal(position.amountPaidToDate, 85_000_000);
  // Still to certify.
  assert.equal(position.outstanding, 854_200_000 - 105_187_500);
  // Certified and awaiting payment.
  assert.equal(position.unpaidCertified, 105_187_500 - 85_000_000);
  assert.equal(position.retentionHeld, 1_009_375);
  // The ₦85m deposit is funding; it is reported, but it is not "paid".
  assert.deepEqual(position.funding, { deposited: 85_000_000, released: 0 });
});

test("LD exposure is days late beyond the date the contract is measured against, capped", () => {
  const terms = (over: Partial<ContractTerms> = {}): ContractTerms => ({
    contractType: "unit_rate",
    retentionRate: 0.05,
    retentionReleaseMode: "staged_pc_dlp",
    retentionCapPercent: 0,
    advancePercentage: 0.1,
    advanceRecoveryMode: "percentage",
    advanceRecoveryRate: 0.1,
    advanceRecoveryFromCertificate: 2,
    paymentTermsDays: 14,
    defectsLiabilityDays: 365,
    defectsPeriodMonths: 12,
    vatRate: 0.075,
    liquidatedDamagesRate: 500_000,
    liquidatedDamagesCapPercent: 0.1,
    commencementDate: "2026-09-07",
    completionDate: "2026-09-01",
    employerName: null,
    contractorName: null,
    contractForm: "fidic_red",
    valuationFrequency: "monthly",
    contractNotes: null,
    ...over,
  });

  // 12 days past 1 Sept at ₦500k/day = ₦6m, under the ₦85.42m cap.
  const late = ldExposureFor(terms(), "2026-09-01", 854_200_000, TODAY);
  assert.equal(late?.daysLate, 12);
  assert.equal(late?.amount, 6_000_000);
  assert.equal(late?.capAmount, 85_420_000);
  assert.equal(late?.againstDate, "2026-09-01");

  // Not yet due: no exposure.
  const onTime = ldExposureFor(terms(), "2027-03-26", 854_200_000, TODAY);
  assert.equal(onTime?.daysLate, 0);
  assert.equal(onTime?.amount, 0);

  // The cap bites.
  const capped = ldExposureFor(terms({ liquidatedDamagesCapPercent: 0.001 }), "2026-09-01", 854_200_000, TODAY);
  assert.equal(capped?.amount, 854_200);

  // No agreed rate means no exposure figure at all, rather than a zero that reads as "none due".
  assert.equal(ldExposureFor(terms({ liquidatedDamagesRate: 0 }), "2026-09-01", 854_200_000, TODAY), null);
});

test("LD exposure is measured against the revised completion once an EOT moved it", async () => {
  const service = financeSummaryService({
    finances: { findSummary: async () => financesRow() },
    summary: summaryRepo({
      projectDates: async () => ({
        completion_date: "2026-09-01",
        revised_completion_date: "2026-09-15",
      }),
      eotDays: async () => ({ approved: "14", pending: "0" }),
    }),
    stageCosts: { byProject: async () => ({ stages: [] }) },
    stages: async () => [],
  });
  const position = await service.get("prj_1", TODAY);
  assert.equal(position.revisedCompletionDate, "2026-09-15");
  // The EOT moved completion past today, so nothing is exposed.
  assert.equal(position.ldExposure?.daysLate, 0);
  assert.equal(position.ldExposure?.againstDate, "2026-09-15");
  assert.deepEqual(position.eot, { daysApproved: 14, daysPending: 0 });
});

test("a stage with no estimate is measured against its scheduled value, not against zero", () => {
  const lines = stageBudgetLines(
    [
      { stageId: "stg_1", name: "Mobilisation", scheduledValue: 42_500_000, expectedCost: 0 },
      { stageId: "stg_2", name: "Drainage", scheduledValue: 110_500_000, expectedCost: 90_000_000 },
    ],
    new Map([
      ["stg_1", { committed: 0, actual: 20_750_000 }],
      ["stg_2", { committed: 30_800_000, actual: 0 }],
    ]),
  );
  // ₦20.75m spent against a ₦42.5m stage is not an overrun.
  assert.equal(lines[0]?.budgetSource, "scheduled_value");
  assert.equal(lines[0]?.budget, 42_500_000);
  assert.equal(lines[0]?.variance, 21_750_000);
  // Where an estimate exists it wins.
  assert.equal(lines[1]?.budgetSource, "expected_cost");
  assert.equal(lines[1]?.variance, 59_200_000);
});

test("nothing certified leaves the whole adjusted contract outstanding", async () => {
  const service = financeSummaryService({
    finances: { findSummary: async () => financesRow() },
    summary: summaryRepo({
      certifiedTotals: async () => ({
        certified: "0",
        retention: "0",
        advance_recovered: "0",
        certificates: "0",
      }),
      paidTotal: async () => "0",
    }),
    stageCosts: { byProject: async () => ({ stages: [] }) },
    stages: async () => [],
  });
  const position = await service.get("prj_1", TODAY);
  assert.equal(position.outstanding, 854_200_000);
  assert.equal(position.unpaidCertified, 0);
});
