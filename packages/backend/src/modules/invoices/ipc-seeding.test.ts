import { test } from "node:test";
import assert from "node:assert/strict";
import type { ContractTerms } from "../finances/types.ts";
import { seedCertificate } from "./ipc-seeding.ts";

// The road job's actual terms: retention 5%, advance 10% recovered at 10% per
// certificate from IPC 2, VAT 7.5%. Every rate a fraction.
function terms(over: Partial<ContractTerms> = {}): ContractTerms {
  return {
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
    liquidatedDamagesRate: 0,
    liquidatedDamagesCapPercent: 0,
    commencementDate: null,
    completionDate: null,
    employerName: null,
    contractorName: null,
    contractForm: "fidic_red",
    valuationFrequency: "monthly",
    contractNotes: null,
    ...over,
  };
}

const SEPT_LINES = [
  { description: "Mobilisation & site establishment", quantity: 1, unitRate: 17_000_000 },
  { description: "Survey, setting out & traffic management", quantity: 1, unitRate: 3_187_500 },
];

test("IPC 1 takes retention and VAT from the contract, not from form defaults", () => {
  const ipc = seedCertificate(terms(), {
    lines: SEPT_LINES,
    previousCertified: 0,
    retentionHeldToDate: 0,
    advancePaid: 85_000_000,
    advanceRecoveredToDate: 0,
    certificateNumber: 1,
    adjustedContract: 854_200_000,
  });
  assert.equal(ipc.thisCertificate, 20_187_500);
  assert.equal(ipc.previousCertified, 0);
  assert.equal(ipc.cumulative, 20_187_500);
  // 5% of the gross, as the contract says — not the 0% the form used to seed.
  assert.equal(ipc.retention, 1_009_375);
  assert.equal(ipc.vat, 1_514_062.5);
  // Nothing recovered on IPC 1: the contract starts recovery at certificate 2.
  assert.equal(ipc.advanceRecovery, 0);
  assert.equal(ipc.netPayable, 20_187_500 - 1_009_375 + 1_514_062.5);
});

test("advance recovery starts at the certificate the contract names", () => {
  const second = seedCertificate(terms(), {
    lines: [{ description: "Earthworks", quantity: 1, unitRate: 30_000_000 }],
    previousCertified: 20_187_500,
    retentionHeldToDate: 1_009_375,
    advancePaid: 85_000_000,
    advanceRecoveredToDate: 0,
    certificateNumber: 2,
    adjustedContract: 854_200_000,
  });
  assert.equal(second.previousCertified, 20_187_500);
  assert.equal(second.cumulative, 50_187_500);
  assert.equal(second.advanceRecovery, 3_000_000); // 10% of this certificate
  assert.equal(second.retention, 1_500_000);
});

test("recovery never exceeds what is still outstanding on the advance", () => {
  const ipc = seedCertificate(terms({ advanceRecoveryRate: 1 }), {
    lines: [{ description: "Asphalt", quantity: 1, unitRate: 90_000_000 }],
    previousCertified: 0,
    retentionHeldToDate: 0,
    advancePaid: 85_000_000,
    advanceRecoveredToDate: 80_000_000,
    certificateNumber: 3,
    adjustedContract: 854_200_000,
  });
  assert.equal(ipc.advanceRecovery, 5_000_000);
});

test("a fixed recovery amount is taken instead of a percentage when the contract says so", () => {
  const ipc = seedCertificate(terms({ advanceRecoveryMode: "fixed", advanceRecoveryRate: 8_500_000 }), {
    lines: [{ description: "Drainage", quantity: 1, unitRate: 40_000_000 }],
    previousCertified: 0,
    retentionHeldToDate: 0,
    advancePaid: 85_000_000,
    advanceRecoveredToDate: 0,
    certificateNumber: 2,
    adjustedContract: 854_200_000,
  });
  assert.equal(ipc.advanceRecovery, 8_500_000);
});

test("retention stops accruing at the contract cap", () => {
  // Cap 2.5% of 854.2m = 21,355,000; 21,000,000 is already held.
  const ipc = seedCertificate(terms({ retentionCapPercent: 0.025 }), {
    lines: [{ description: "Asphalt", quantity: 1, unitRate: 90_000_000 }],
    previousCertified: 420_000_000,
    retentionHeldToDate: 21_000_000,
    advancePaid: 0,
    advanceRecoveredToDate: 0,
    certificateNumber: 6,
    adjustedContract: 854_200_000,
  });
  // 5% would be 4.5m; only the 355,000 of headroom is taken.
  assert.equal(ipc.retention, 355_000);
});

test("no advance means no recovery line at all", () => {
  const ipc = seedCertificate(terms(), {
    lines: SEPT_LINES,
    previousCertified: 0,
    retentionHeldToDate: 0,
    advancePaid: 0,
    advanceRecoveredToDate: 0,
    certificateNumber: 4,
    adjustedContract: 854_200_000,
  });
  assert.equal(ipc.advanceRecovery, 0);
});
