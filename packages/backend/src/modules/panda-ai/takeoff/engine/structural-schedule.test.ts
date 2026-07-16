import { test } from "node:test";
import assert from "node:assert/strict";
import { barMassKgPerM, barTonnes, nearestBarSize } from "./steel-mass.ts";
import { readBbs, bbsToItems, looksLikeBbs } from "./structural-schedule.ts";

test("barMassKgPerM: BS4449 tabulated values", () => {
  assert.equal(barMassKgPerM(12), 0.888);
  assert.equal(barMassKgPerM(16), 1.578);
  assert.equal(barMassKgPerM(20), 2.466);
  assert.equal(barMassKgPerM(32), 6.313);
});

test("barMassKgPerM: off-table size falls back to the formula", () => {
  const m = barMassKgPerM(14)!;
  assert.ok(Math.abs(m - 1.208) < 0.005, `14mm ~1.208 kg/m, got ${m}`);
});

test("nearestBarSize snaps to standard sizes", () => {
  assert.equal(nearestBarSize(13), 12);
  assert.equal(nearestBarSize(17), 16);
  assert.equal(nearestBarSize(21), 20);
});

test("barTonnes: 100 bars of 16mm x 12m = 1.89 t", () => {
  const t = barTonnes(16, 100, 12000)!;
  // 1.578 kg/m * 100 * 12m = 1893.6 kg = 1.8936 t
  assert.ok(Math.abs(t - 1.8936) < 0.001, `got ${t}`);
});

test("looksLikeBbs: needs a schedule marker + numeric bar rows", () => {
  assert.equal(looksLikeBbs(["Bar Bending Schedule", "01 T16 40 5000", "02 T12 60 3000", "03 T20 20 6000"]), true);
  assert.equal(looksLikeBbs(["Floor Plan", "Kitchen", "Bedroom"]), false);
});

test("readBbs: parses bars and totals tonnage by size", () => {
  const reading = readBbs([
    "Reinforcement Schedule",
    "Mark Size No Length",
    "01 T16 100 12000",
    "02 T16 50 6000",
    "03 T20 40 8000",
  ]);
  assert.ok(reading);
  // 16mm: 100x12m + 50x6m = 1893.6 + 473.4 = 2367 kg = 2.37 t
  assert.ok(Math.abs(reading!.tonnesBySize[16]! - 2.367) < 0.01, `16mm ${reading!.tonnesBySize[16]}`);
  // 20mm: 2.466 * 40 * 8 = 789.12 kg = 0.79 t
  assert.ok(Math.abs(reading!.tonnesBySize[20]! - 0.789) < 0.01, `20mm ${reading!.tonnesBySize[20]}`);
});

test("readBbs REFUSES to fabricate: no schedule marker returns null", () => {
  assert.equal(readBbs(["Ground Floor Plan", "300 x 300 column", "beam 600 deep"]), null);
});

test("bbsToItems: emits reinforcement items in tonnes by nominal size", () => {
  const reading = readBbs([
    "Bar Bending Schedule",
    "01 T16 100 12000",
    "02 T20 40 8000",
    "03 T12 80 4000",
  ])!;
  const items = bbsToItems(reading, 5);
  assert.ok(items.length >= 3);
  for (const item of items) {
    assert.equal(item.unit, "tonnes");
    assert.equal(item.workSection.code, "1.11");
    assert.equal(item.confidence, "high");
    assert.equal(item.qty, item.qtyGross);
    assert.match(item.description, /nominal size/);
  }
});
