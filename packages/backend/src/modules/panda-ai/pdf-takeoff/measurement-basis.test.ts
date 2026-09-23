import assert from "node:assert/strict";
import { test } from "node:test";
import { basisFor, basisHeadOf } from "./measurement-basis.ts";
import { manualBasis, netQuantity } from "./measurements.ts";
import type { ManualQuantity } from "./types.ts";

// The sentence a bill line is defended with, pinned to the figure beside it.
//
// The F3 browser gate found two lines whose `measurement_basis` contradicted
// their own quantity. Both were traced to the writer path, not to a stale
// fixture: the sentence used to be maintained by two independent string
// editors, so the ORDER of a QS's edits decided what the line ended up
// asserting. The sequences below are the ones the gate observed, replayed
// through the composer that replaced them.
//
// Every figure here is hand-checkable: net = (gross − Σdeductions) × typical.

interface Opening {
  label: string;
  qty: number;
}

/** One write of the sentence, with the net derived the way the row derives it. */
function rewrite(
  basis: string | null,
  gross: number,
  deductions: Opening[],
  typical: number,
  unit: string | null,
): string | null {
  return basisFor({ basis, gross, deductions, typical, net: netQuantity(gross, deductions, typical), unit });
}

// `geometryKind` is the shape DRAWN, not the unit billed: `GEOMETRY_KIND_BY_TOOL`
// maps both `area` and `volume` to "area", because a slab is a polygon given a depth.
const AREA_24: ManualQuantity = { base: 24, baseUnit: "m2", gross: 24, unit: "m2", geometryKind: "area" };
const SLAB_150: ManualQuantity = { base: 24, baseUnit: "m2", gross: 3.6, unit: "m3", geometryKind: "area" };

test("REGRESSION F3/M3: a repeating line with two openings never asserts a superseded multiplier", () => {
  const gross = 24;
  const first: Opening[] = [{ label: "QA stated void", qty: 2 }];
  const both: Opening[] = [...first, { label: "QA int drawn void", qty: 1 }];

  // The QA fixture as drawn: 24 m2 over 2 typical floors, no openings yet.
  let basis: string | null = manualBasis("area", AREA_24, "on QA-01", {}, 2, "m2");
  assert.equal(basis, "24 m2 area on QA-01 × 2 typical floors = 48 m2");

  basis = rewrite(basis, gross, first, 2, "m2");
  assert.equal(basis, "24 m2 area on QA-01 − 2 m2 deducted (QA stated void) × 2 typical floors = 44 m2");

  basis = rewrite(basis, gross, both, 2, "m2");
  assert.equal(basis, "24 m2 area on QA-01 − 3 m2 deducted (QA stated void, QA int drawn void) × 2 typical floors = 42 m2");

  // The gate's observed state: typical back to 1, the line billing 21.
  basis = rewrite(basis, gross, both, 1, "m2");
  assert.equal(
    basis,
    "24 m2 area on QA-01 − 3 m2 deducted (QA stated void, QA int drawn void) = 21 m2",
    "(24 − 3) × 1 = 21, and the sentence says exactly that",
  );
  assert.doesNotMatch(basis ?? "", /typical/u, "the superseded × 2 is gone, not merely appended past");
  assert.doesNotMatch(basis ?? "", /48/u, "and so is the total it produced");
});

test("REGRESSION F3/M4: changing a depth keeps the opening in the sentence", () => {
  const opening: Opening[] = [{ label: "Duct opening", qty: 0.3 }];

  let basis: string | null = manualBasis("volume", SLAB_150, "on QA-01", { depthM: 0.15 }, 1, "m3");
  basis = rewrite(basis, 3.6, opening, 1, "m3");
  assert.equal(basis, "24 m2 area on QA-01 × 0.15 m depth − 0.3 m3 deducted (Duct opening) = 3.3 m3");

  // editFactorIn builds a fresh head, which carries no openings of its own.
  basis = rewrite("Depth set to 0.2 m; 24 m2 × 0.2 m depth; gross 4.8 m3", 4.8, opening, 1, "m3");
  assert.equal(basis, "Depth set to 0.2 m; 24 m2 × 0.2 m depth; gross 4.8 m3 − 0.3 m3 deducted (Duct opening) = 4.5 m3");
  assert.match(basis ?? "", /Duct opening/u, "the opening the figure already reflects is still named");
});

test("the slab the plan specifies: 24 m2 × 0.15 m less a 2 m2 opening at the same depth is 3.3 m3", () => {
  const gross = 3.6;
  const opening: Opening[] = [{ label: "Duct opening", qty: 0.3 }];
  assert.equal(netQuantity(gross, opening, 1), 3.3, "24 × 0.15 = 3.6; 2 × 0.15 = 0.3; 3.6 − 0.3 = 3.3");

  const basis = rewrite(manualBasis("volume", SLAB_150, "on QA-01", { depthM: 0.15 }, 1, "m3"), gross, opening, 1, "m3");
  assert.equal(basis, "24 m2 area on QA-01 × 0.15 m depth − 0.3 m3 deducted (Duct opening) = 3.3 m3");
});

test("a wall states its gross once, not twice", () => {
  const head = "Manually re-measured (wall area); 7 m × 3 m height; gross 21 m2";
  const window: Opening[] = [{ label: "Window W1", qty: 2 }];

  let basis = rewrite(head, 21, [], 1, "m2");
  assert.equal(basis, "Manually re-measured (wall area); 7 m × 3 m height; gross 21 m2 = 21 m2");

  basis = rewrite(basis, 21, window, 1, "m2");
  assert.equal(basis, "Manually re-measured (wall area); 7 m × 3 m height; gross 21 m2 − 2 m2 deducted (Window W1) = 19 m2");
  assert.equal((basis?.match(/=/gu) ?? []).length, 1, "one total, not a chain of superseded ones");
});

test("rewriting a sentence that is already true changes nothing", () => {
  const openings: Opening[] = [{ label: "Window W1", qty: 2 }];
  const once = rewrite("Manually re-measured (wall area); 7 m × 3 m height; gross 21 m2", 21, openings, 1, "m2");
  const twice = rewrite(once, 21, openings, 1, "m2");
  const thrice = rewrite(twice, 21, openings, 1, "m2");
  assert.equal(twice, once);
  assert.equal(thrice, once);
});

test("an undone typical change restores the sentence byte for byte", () => {
  const openings: Opening[] = [{ label: "Stair void", qty: 3 }];
  const at2 = rewrite("24 m2 area on QA-01", 24, openings, 2, "m2");
  const at1 = rewrite(at2, 24, openings, 1, "m2");
  const back = rewrite(at1, 24, openings, 2, "m2");
  assert.equal(at1, "24 m2 area on QA-01 − 3 m2 deducted (Stair void) = 21 m2");
  assert.equal(back, at2, "the round trip is lossless, so an undo restores what was recorded");
});

test("the sentence does not depend on the order the edits were made in", () => {
  const openings: Opening[] = [{ label: "Window W1", qty: 2 }];
  const deductThenRepeat = rewrite(rewrite("24 m2 area on QA-01", 24, openings, 1, "m2"), 24, openings, 3, "m2");
  const repeatThenDeduct = rewrite(rewrite("24 m2 area on QA-01", 24, [], 3, "m2"), 24, openings, 3, "m2");
  assert.equal(deductThenRepeat, "24 m2 area on QA-01 − 2 m2 deducted (Window W1) × 3 typical floors = 66 m2");
  assert.equal(repeatThenDeduct, deductThenRepeat);
});

test("a line that records no basis does not acquire one", () => {
  assert.equal(basisFor({ basis: null, gross: 24, deductions: [], typical: 2, net: 48, unit: "m2" }), null);
});

test("a legacy figure in no stated unit stays in no stated unit", () => {
  const basis = rewrite("12 on LEG-01", 12, [{ label: "Void", qty: 2 }], 1, null);
  assert.equal(basis, "12 on LEG-01 − 2 deducted (Void) = 10");
  assert.doesNotMatch(basis ?? "", /m2|m3|\bnr\b/u, "no unit is invented for a line that never recorded one");
});

test("a bare drawn figure is its own total and is left alone", () => {
  assert.equal(rewrite("12 m2 on LEG-01", 12, [], 1, "m2"), "12 m2 on LEG-01");
  assert.equal(rewrite("5 nr count on QA-01", 5, [], 1, "nr"), "5 nr count on QA-01");
});

test("a line mid-repair says so, and still shows its clamped zero", () => {
  const basis = basisFor({
    basis: "24 m2 area on QA-01",
    gross: 24,
    deductions: [{ label: "Oversized void", qty: 30 }],
    typical: 1,
    net: 0,
    unit: "m2",
    deficit: 6,
  });
  assert.equal(basis, "24 m2 area on QA-01 − 30 m2 deducted (Oversized void) (deductions exceed gross) = 0 m2");
});

test("a writer's own words survive verbatim, including its own × factors", () => {
  const assembly = "12.4 m polyline on DWG-01 × factor 2.7 (Blockwall 225: Plaster both sides)";
  assert.equal(basisHeadOf(`${assembly} × 2 typical floors = 66.96 m2`), assembly);
  assert.equal(
    rewrite(`${assembly} × 2 typical floors = 66.96 m2`, 33.48, [], 2, "m2"),
    `${assembly} × 2 typical floors = 66.96 m2`,
    "an assembly factor is part of the head, not a clause the composer owns",
  );
});

test("a total stranded mid-sentence by the old append order is taken back", () => {
  const drifted = "24 m2 area on QA-01 × 2 typical floors = 48 m2 − 3 m2 deducted (A, B)";
  assert.equal(basisHeadOf(drifted), "24 m2 area on QA-01");
});

test("a legacy sentence with no clauses this module owns keeps its words", () => {
  assert.equal(basisHeadOf("Measured from pile schedule: 12 nr 450mm piles (page 3)"), "Measured from pile schedule: 12 nr 450mm piles (page 3)");
  assert.equal(basisHeadOf("100 m2 stated in the schedule less 2 m2 opening"), "100 m2 stated in the schedule less 2 m2 opening");
});

test("a sentence worn down to nothing still says what was measured", () => {
  assert.equal(rewrite("× 4 typical floors = 12 m2", 3, [], 4, "m2"), "3 m2 × 4 typical floors = 12 m2");
});
