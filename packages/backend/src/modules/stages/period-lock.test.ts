import { test } from "node:test";
import assert from "node:assert/strict";
import { isForecastPeriod, periodLock, withForecastFlags } from "./period-lock.ts";
import type { StageScheduleOfValue } from "./types.ts";

const TODAY = "2026-09-13";

function line(period: string): StageScheduleOfValue {
  return {
    id: `sov_${period}`,
    stageId: "stg_1",
    period,
    percent: 40,
    amount: 17_000_000,
    billed: false,
    sortOrder: 0,
    percentComplete: 40,
    periodPercent: 40,
    periodAmount: 17_000_000,
    toDateAmount: 17_000_000,
  };
}

function lock(certified: Record<string, string | undefined>) {
  return periodLock({
    certificateForPeriod: async (_projectId, period) => {
      const number = certified[period];
      return number ? { id: `inv_${period}`, number } : undefined;
    },
  });
}

test("a certified month is closed, and the message names the certificate", async () => {
  await assert.rejects(
    lock({ "2026-09": "IS2-IPC-001" }).assertEditable("prj_1", "2026-09"),
    /Period 2026-09 is certified on IS2-IPC-001; raise a correction on the next certificate/,
  );
});

test("an uncertified month stays editable and removable", async () => {
  const l = lock({ "2026-09": "IS2-IPC-001" });
  await assert.doesNotReject(l.assertEditable("prj_1", "2026-10"));
  await assert.doesNotReject(l.assertRemovable("prj_1", "2026-10"));
  await assert.rejects(l.assertRemovable("prj_1", "2026-09"), /is certified on/);
});

test("a month that has not happened yet is only accepted as a forecast", () => {
  const l = lock({});
  assert.equal(isForecastPeriod("2026-10", TODAY), true);
  assert.equal(isForecastPeriod("2026-09", TODAY), false);
  assert.equal(isForecastPeriod("2026-08", TODAY), false);

  assert.throws(
    () => l.assertClaimable("2026-10", false, TODAY),
    /has not been worked yet — record it as a forecast/,
  );
  assert.doesNotThrow(() => l.assertClaimable("2026-10", true, TODAY));
  // The current month is a real valuation, not a forecast.
  assert.doesNotThrow(() => l.assertClaimable("2026-09", false, TODAY));
});

test("forecast months are flagged and are never claimable; certified months are not claimable either", () => {
  const flagged = withForecastFlags(
    [line("2026-08"), line("2026-09"), line("2026-10")],
    new Set(["2026-08"]),
    TODAY,
  );
  assert.deepEqual(
    flagged.map((l) => [l.period, l.forecast, l.claimable]),
    [
      ["2026-08", false, false], // already certified
      ["2026-09", false, true],
      ["2026-10", true, false], // future: a projection, not a claim
    ],
  );
  // The figures themselves are untouched — a forecast still carries the QS's numbers.
  assert.equal(flagged[2]?.periodAmount, 17_000_000);
});
