import { test } from "node:test";
import assert from "node:assert/strict";
import { Money } from "./money.ts";

test("add avoids binary float drift (0.1 + 0.2 === 0.30)", () => {
  assert.equal(Money.of("0.1").add("0.2").toNumber(), 0.3);
  assert.equal(Money.of(0.1).add(0.2).toFixed(2), "0.30");
});

test("sum of many small amounts stays exact", () => {
  const items = Array.from({ length: 10 }, () => "0.1");
  assert.equal(Money.sum(items).toNumber(), 1);
});

test("percent computes VAT / retention without drift", () => {
  assert.equal(Money.of(200).percent(7.5).toNumber(), 15);
  // 1234.55 @ 7.5% = 92.59125 -> 92.59 (half-up)
  assert.equal(Money.of("1234.55").percent(7.5).round(2).toFixed(2), "92.59");
});

test("round is half-up at 2dp on exact decimal ties", () => {
  // Native Math.round(1.005 * 100) / 100 === 1 (float error); Money is exact.
  assert.equal(Money.of("1.005").round(2).toFixed(2), "1.01");
  assert.equal(Money.of("2.675").round(2).toFixed(2), "2.68");
});

test("invoice totals reconcile (subtotal + vat - wht - retention)", () => {
  const subtotal = Money.sum(["100.10", "200.20", "50.05"]).round(2); // 350.35
  const vat = subtotal.percent(7.5).round(2); // 26.28  (26.27625)
  const wht = subtotal.percent(5).round(2); // 17.52  (17.5175)
  const retention = subtotal.percent(10).round(2); // 35.04  (35.035)
  const totalInvoiced = subtotal.add(vat).round(2); // 376.63
  const netPayable = totalInvoiced.sub(wht).sub(retention).round(2); // 324.07
  assert.equal(subtotal.toFixed(2), "350.35");
  assert.equal(vat.toFixed(2), "26.28");
  assert.equal(wht.toFixed(2), "17.52");
  assert.equal(retention.toFixed(2), "35.04");
  assert.equal(totalInvoiced.toFixed(2), "376.63");
  assert.equal(netPayable.toFixed(2), "324.07");
});

test("allocate splits equally with largest remainder (no lost cents)", () => {
  const parts = Money.of("100.00").allocate([1, 1, 1]);
  assert.deepEqual(
    parts.map((p) => p.toFixed(2)),
    ["33.34", "33.33", "33.33"],
  );
  assert.equal(Money.sum(parts).toFixed(2), "100.00");
});

test("allocate distributes by weight and sums exactly", () => {
  const parts = Money.of("100.00").allocate([1, 2, 1]); // 25 / 50 / 25
  assert.deepEqual(
    parts.map((p) => p.toFixed(2)),
    ["25.00", "50.00", "25.00"],
  );
  assert.equal(Money.sum(parts).toFixed(2), "100.00");
});

test("allocate handles indivisible penny counts", () => {
  const parts = Money.of("0.10").allocate([1, 1, 1]); // 10 cents / 3
  assert.deepEqual(
    parts.map((p) => p.toFixed(2)),
    ["0.04", "0.03", "0.03"],
  );
  assert.equal(Money.sum(parts).toFixed(2), "0.10");
});

test("split into equal shares sums exactly", () => {
  const parts = Money.of("10.00").split(3);
  assert.equal(Money.sum(parts).toFixed(2), "10.00");
});

test("non-finite input is coerced to zero", () => {
  assert.equal(Money.of(Number.NaN).toNumber(), 0);
  assert.equal(Money.of(Number.POSITIVE_INFINITY).toNumber(), 0);
});

test("comparisons behave", () => {
  assert.equal(Money.of("1.10").gt("1.09"), true);
  assert.equal(Money.of("1.10").lt("1.11"), true);
  assert.equal(Money.of("1.10").eq(1.1), true);
  assert.equal(Money.of("0").isZero(), true);
});
