import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicatePlans, samePlan, type PlanFingerprint } from "./fingerprint.ts";

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
  const dupes = findDuplicatePlans([fp(2), fp(3, { centrelineM: 356.9, tagSignature: "x" }), fp(5), fp(6, { centrelineM: 161 })]);
  assert.equal(dupes.get(5), 2);
  assert.equal(dupes.get(6), 2);
  assert.equal(dupes.has(3), false);
});
