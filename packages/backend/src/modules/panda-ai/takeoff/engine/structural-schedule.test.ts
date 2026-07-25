import { test } from "node:test";
import assert from "node:assert/strict";
import { barMassKgPerM, barTonnes, nearestBarSize } from "./steel-mass.ts";
import { readBbs, bbsToItems, looksLikeBbs, readPileSchedule, pileScheduleToItems, looksLikePileSchedule } from "./structural-schedule.ts";

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

test("looksLikePileSchedule: needs a pile marker + diameter rows", () => {
  assert.equal(looksLikePileSchedule(["Pile Schedule", "P1 600 12 25", "P2 600 8 30"]), true);
  assert.equal(looksLikePileSchedule(["Floor Plan", "Bedroom", "Kitchen"]), false);
});

test("readPileSchedule: totals number and length by diameter", () => {
  const reading = readPileSchedule([
    "Pile Schedule",
    "Mark Dia No Length",
    "P1 600 12 25",
    "P2 600 8 30",
    "P3 900 4 35",
  ]);
  assert.ok(reading);
  // 600mm: 12 + 8 = 20 piles; length 12x25 + 8x30 = 540m
  assert.equal(reading!.byDiameter[600]!.number, 20);
  assert.equal(reading!.byDiameter[600]!.totalLengthM, 540);
  assert.equal(reading!.byDiameter[900]!.number, 4);
});

test("readPileSchedule REFUSES to fabricate: no pile marker returns null", () => {
  assert.equal(readPileSchedule(["Ground Floor Plan", "column 600", "beam 300"]), null);
});

test("pileScheduleToItems: emits nr + concrete-length items in piling section", () => {
  const reading = readPileSchedule(["Pile Schedule", "P1 600 12 25", "P2 900 4 35"])!;
  const items = pileScheduleToItems(reading, 3);
  const nrItems = items.filter((i) => i.unit === "nr");
  const mItems = items.filter((i) => i.unit === "m");
  assert.ok(nrItems.length >= 2);
  assert.ok(mItems.length >= 2);
  for (const item of items) {
    assert.equal(item.workSection.code, "1.7");
    assert.equal(item.confidence, "high");
    assert.match(item.description, /Bored piles/);
  }
});

test("readBbs: comma thousands '12,000' parse correctly (not silently dropped)", () => {
  const r = readBbs(["Bar Bending Schedule", "01 T16 40 12,000", "02 T20 30 10,000", "03 T25 20 8,000"]);
  assert.ok(r);
  assert.equal(r!.unreadable, false);
  // 16:40x12x1.578/1000=0.757 + 20:30x10x2.466/1000=0.740 + 25:20x8x3.854/1000=0.617 = 2.114
  assert.ok(Math.abs(r!.totalTonnes - 2.114) < 0.01, `got ${r!.totalTonnes}`);
});

test("readBbs: metre cut length '12.0' parses same as mm equivalent", () => {
  const metres = readBbs(["Bar Bending Schedule", "01 T16 40 12.0", "02 T20 30 10.0", "03 T25 20 8.0"]);
  assert.ok(metres);
  assert.equal(metres!.unreadable, false);
  assert.ok(Math.abs(metres!.totalTonnes - 2.114) < 0.01, `got ${metres!.totalTonnes}`);
});

test("readBbs: bar spacing suffix 'T16-150' does not pollute the quantity", () => {
  const r = readBbs(["Reinforcement Schedule", "01 T16-150 200 5000", "02 T12-200 150 4000", "03 T10-100 300 3000"]);
  assert.ok(r);
  // 150/200/100 spacings must be stripped; 16mm row = 200 bars x 5m
  const s16 = r!.rows.find((x) => x.sizeMm === 16)!;
  assert.equal(s16.number, 200);
  assert.equal(s16.lengthMm, 5000);
});

test("readBbs REFUSES: a BBS whose rows cannot be parsed is flagged unreadable, not zeroed", () => {
  const r = readBbs(["Bar Bending Schedule", "refer to structural engineer", "TBC", "provisional sum", "see drawing 401"]);
  // either not recognised as a BBS (null) or recognised but flagged unreadable
  if (r) assert.equal(r.unreadable, true);
});
