import assert from "node:assert/strict";
import { test } from "node:test";
import { affineOf, applyAffine, conjugateAffine, invertAffine, type Affine } from "./overlay-model.ts";

const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];
// pt→px flip at 1.5 px/pt on an 840px-tall canvas: (x, y) → (1.5x, 840 − 1.5y)
const FLIP = affineOf(([x, y]) => [1.5 * x!, 840 - 1.5 * y!]);

test("identity in sheet points renders as identity in canvas pixels", () => {
  assert.deepEqual(conjugateAffine(FLIP, IDENTITY).map(Math.round), [1, 0, 0, 1, 0, 0]);
});

test("a pure translation flips its y for the canvas (sheet y is up)", () => {
  const css = conjugateAffine(FLIP, [1, 0, 0, 1, 10, 20]);
  assert.deepEqual(css.map(Math.round), [1, 0, 0, 1, 15, -30]);
});

test("applyAffine and its inverse round-trip a point", () => {
  const m: [number, number, number, number, number, number] = [1.2, 0.1, -0.1, 1.2, 30, -12];
  const p: [number, number] = [123, 456];
  const there = applyAffine(m, p);
  const back = applyAffine(invertAffine(m), there);
  assert.ok(Math.abs(back[0] - p[0]) < 1e-9 && Math.abs(back[1] - p[1]) < 1e-9);
});
