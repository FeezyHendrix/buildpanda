import assert from "node:assert/strict";
import { test } from "node:test";
import { firstVertexCloseTarget, formulaParts, polygonSelfIntersects } from "./polygon-validity.ts";

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const BOWTIE = [
  [0, 0],
  [10, 10],
  [10, 0],
  [0, 10],
];

test("a simple square does not self-intersect", () => {
  assert.equal(polygonSelfIntersects(SQUARE), false);
});

test("a bow-tie self-intersects when closed", () => {
  assert.equal(polygonSelfIntersects(BOWTIE), true);
});

test("fewer than four vertices can never self-intersect", () => {
  assert.equal(polygonSelfIntersects(SQUARE.slice(0, 3)), false);
});

test("shared endpoints of neighbouring segments are not intersections", () => {
  assert.equal(
    polygonSelfIntersects([
      [0, 0],
      [10, 0],
      [10, 10],
      [5, 10],
      [0, 10],
    ]),
    false,
  );
});

test("close target is the first anchor once three points are down and the click lands near it", () => {
  assert.deepEqual(firstVertexCloseTarget(SQUARE.slice(0, 3), [0.5, 0.4], 2), [0, 0]);
  assert.equal(firstVertexCloseTarget(SQUARE.slice(0, 3), [5, 5], 2), null);
  assert.equal(firstVertexCloseTarget(SQUARE.slice(0, 2), [0.5, 0.4], 2), null);
});

test("formulaParts renders (gross − deductions) × N with parentheses", () => {
  assert.equal(formulaParts({ gross: 24, deductions: 2, typical: 2, net: 44, unit: "m2" }), "(24 − 2) × 2 = 44 m2");
  assert.equal(formulaParts({ gross: 24, deductions: 0, typical: 1, net: 24, unit: "m2" }), "(24 − 0) × 1 = 24 m2");
  assert.equal(formulaParts({ gross: 22, deductions: null, typical: 1, net: 22, unit: null }), "(22 − 0) × 1 = 22");
});
