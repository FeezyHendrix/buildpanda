import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicatePlans, applyFloorRepetition, samePlan, type PlanFingerprint } from "./fingerprint.ts";
import type { MeasuredBoqItem } from "../types.ts";

const item = (page: number, o: Partial<MeasuredBoqItem> = {}): MeasuredBoqItem => ({
  elementGroup: "Internal and external walls",
  workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
  specNote: null,
  code: "F10/125",
  description: "blockwall",
  unit: "m2",
  qtyGross: 100,
  deductions: [],
  qty: 100,
  confidence: "high",
  measurementBasis: "measured",
  geometries: [],
  pageNumber: page,
  scope: "per-floor",
  ...o,
});

const fp = (pageNumber: number, overrides: Partial<PlanFingerprint> = {}): PlanFingerprint => ({
  pageNumber,
  centrelineM: 160,
  wallPairs: 160,
  widthM: 28.4,
  heightM: 19.2,
  doorArcs: 23,
  tagSignature: "D5:3,W11:7",
  ...overrides,
});

test("samePlan: identical geometry within tolerance matches", () => {
  assert.equal(samePlan(fp(2), fp(5, { centrelineM: 161.5, widthM: 28.6 })), true);
});

test("samePlan: different centreline or tags do not match", () => {
  assert.equal(samePlan(fp(2), fp(3, { centrelineM: 356.9 })), false);
  assert.equal(samePlan(fp(2), fp(3, { tagSignature: "D5:3,W11:9" })), false);
});

test("findDuplicatePlans keeps first page as representative", () => {
  const { duplicateOf } = findDuplicatePlans([fp(2), fp(3, { centrelineM: 356.9, tagSignature: "x" }), fp(5), fp(6, { centrelineM: 161 })]);
  assert.equal(duplicateOf.get(5), 2);
  assert.equal(duplicateOf.get(6), 2);
  assert.equal(duplicateOf.has(3), false);
});

test("findDuplicatePlans groups identical floors with a multiply count", () => {
  // pages 2,5,6 identical (typical floor drawn 3x); page 3 distinct
  const { groups } = findDuplicatePlans([fp(2), fp(3, { centrelineM: 356.9, tagSignature: "x" }), fp(5), fp(6, { centrelineM: 161 })]);
  assert.equal(groups.get(2)!.groupSize, 3);
  assert.deepEqual(groups.get(2)!.members, [2, 5, 6]);
  assert.equal(groups.get(3)!.groupSize, 1); // distinct floor stands alone
});

test("findDuplicatePlans: no repeats -> every floor groupSize 1 (bungalow/all-distinct)", () => {
  const { duplicateOf, groups } = findDuplicatePlans([
    fp(2),
    fp(3, { centrelineM: 356.9, tagSignature: "a" }),
    fp(4, { centrelineM: 500, tagSignature: "b" }),
  ]);
  assert.equal(duplicateOf.size, 0);
  for (const g of groups.values()) assert.equal(g.groupSize, 1);
});

test("applyFloorRepetition: identical floors MULTIPLY per-floor items (no under-count)", () => {
  // 3 identical typical floors: pages 2,5,6 fingerprint the same
  const dup = findDuplicatePlans([fp(2), fp(5), fp(6)]);
  assert.equal(dup.groups.get(2)!.groupSize, 3);
  const out = applyFloorRepetition([item(2, { qtyGross: 100, qty: 90 }), item(5), item(6)], dup);
  // duplicate pages 5,6 dropped; representative page 2 multiplied x3
  assert.equal(out.length, 1);
  assert.equal(out[0]!.qtyGross, 300); // 100 x 3, not 100 (old drop bug) and not 100 (single)
  assert.equal(out[0]!.qty, 270); // 90 x 3
  assert.match(out[0]!.measurementBasis, /x 3 identical floors/);
});

test("applyFloorRepetition: whole-building items are NOT multiplied", () => {
  // a schedule/substructure item on the representative page must not x N
  const dup = findDuplicatePlans([fp(2), fp(5)]);
  const wholeBuilding = item(2, { scope: "whole-building", elementGroup: "Substructure", qtyGross: 50, qty: 50 });
  const perFloor = item(2, { qtyGross: 100, qty: 100 });
  const out = applyFloorRepetition([wholeBuilding, perFloor, item(5)], dup);
  const sub = out.find((i) => i.elementGroup === "Substructure")!;
  const wall = out.find((i) => i.elementGroup === "Internal and external walls")!;
  assert.equal(sub.qtyGross, 50); // untouched
  assert.equal(wall.qtyGross, 200); // x2
});

test("applyFloorRepetition: distinct floors are summed downstream, not multiplied", () => {
  // two genuinely different floors -> no grouping, both pass through x1
  const dup = findDuplicatePlans([fp(2), fp(3, { centrelineM: 356.9, tagSignature: "different" })]);
  const out = applyFloorRepetition([item(2, { qtyGross: 100 }), item(3, { qtyGross: 80 })], dup);
  assert.equal(out.length, 2);
  assert.equal(out.reduce((s, i) => s + i.qtyGross, 0), 180); // summed as-is, not merged
});
