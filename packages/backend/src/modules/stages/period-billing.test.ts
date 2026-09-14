import { test } from "node:test";
import assert from "node:assert/strict";
import { periodBilling } from "./period-billing.ts";

test("periodBilling: each month bills the movement since the previous month", () => {
  const rows = periodBilling(
    [
      { period: "2026-01", percentComplete: 40 },
      { period: "2026-02", percentComplete: 70 },
      { period: "2026-03", percentComplete: 100 },
    ],
    100000,
  );
  assert.deepEqual(
    rows.map((r) => [r.period, r.cumulativePct, r.periodPct, r.periodAmount, r.toDateAmount]),
    [
      ["2026-01", 40, 40, 40000, 40000],
      ["2026-02", 70, 30, 30000, 70000],
      ["2026-03", 100, 30, 30000, 100000],
    ],
  );
});

test("periodBilling: orders by period whatever order the lines arrive in", () => {
  const rows = periodBilling(
    [
      { period: "2026-03", percentComplete: 90 },
      { period: "2026-01", percentComplete: 25 },
    ],
    1000,
  );
  assert.deepEqual(rows.map((r) => r.period), ["2026-01", "2026-03"]);
  assert.deepEqual(rows.map((r) => r.periodAmount), [250, 650]);
});

test("periodBilling: a month with nothing recorded bills nothing and carries to-date forward", () => {
  const rows = periodBilling(
    [
      { period: "2026-01", percentComplete: 40 },
      { period: "2026-02", percentComplete: null },
    ],
    100000,
  );
  assert.equal(rows[1]?.cumulativePct, null);
  assert.equal(rows[1]?.periodPct, 0);
  assert.equal(rows[1]?.periodAmount, 0);
  assert.equal(rows[1]?.toDateAmount, 40000);
});

test("periodBilling: period amounts reconcile to the to-date amount to the cent", () => {
  const rows = periodBilling(
    [
      { period: "2026-01", percentComplete: 33.33 },
      { period: "2026-02", percentComplete: 66.66 },
      { period: "2026-03", percentComplete: 100 },
    ],
    100,
  );
  const summed = rows.reduce((sum, r) => sum + r.periodAmount, 0);
  assert.equal(Math.round(summed * 100) / 100, rows[rows.length - 1]?.toDateAmount);
  assert.equal(rows[rows.length - 1]?.toDateAmount, 100);
});

test("periodBilling: an unpriced stage bills zero everywhere", () => {
  const rows = periodBilling([{ period: "2026-01", percentComplete: 50 }], 0);
  assert.equal(rows[0]?.periodAmount, 0);
  assert.equal(rows[0]?.toDateAmount, 0);
  assert.equal(rows[0]?.cumulativePct, 50);
});

test("periodBilling: no lines, no rows", () => {
  assert.deepEqual(periodBilling([], 5000), []);
});
