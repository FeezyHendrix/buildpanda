import { test } from "node:test";
import assert from "node:assert/strict";
import { inferUnits } from "./units.ts";
import { synth } from "./fixtures.ts";

test("the header's INSUNITS decides when it is present", () => {
  const s = synth();
  s.header({ INSUNITS: 6 });
  const u = inferUnits(s.doc());
  assert.equal(u.unit, "m");
  assert.equal(u.scaleToMm, 1000);
  assert.equal(u.basis, "header");
  assert.ok(u.errorPct <= 0.05);
});

test("without a header the dimension distribution decides: a median in the hundreds is millimetres", () => {
  const s = synth();
  for (let i = 0; i < 50; i++) s.dim("DIM", 600 + i * 40);
  const u = inferUnits(s.doc());
  assert.equal(u.unit, "mm");
  assert.equal(u.scaleToMm, 1);
  assert.equal(u.basis, "dimensions");
  assert.equal(u.samples, 50);
  assert.match(u.note, /read as mm/);
});

test("a median under fifty is metres", () => {
  const s = synth();
  for (let i = 0; i < 50; i++) s.dim("DIM", 0.6 + i * 0.05);
  const u = inferUnits(s.doc());
  assert.equal(u.unit, "m");
  assert.equal(u.scaleToMm, 1000);
});

test("door leaf widths cross-check the unit and tighten the error when they agree", () => {
  const s = synth();
  for (let i = 0; i < 50; i++) s.dim("DIM", 600 + i * 40);
  const agreeing = inferUnits(s.doc(), [900, 900, 800, 750]);
  assert.ok(agreeing.errorPct <= inferUnits(s.doc()).errorPct);
  assert.match(agreeing.note, /Door leaf widths agree/);
});

test("with no header, no dimensions and no doors the unit is assumed and the error says so", () => {
  const s = synth();
  s.line("WALL", [0, 0], [5000, 0]);
  const u = inferUnits(s.doc());
  assert.equal(u.basis, "assumed");
  assert.ok(u.errorPct >= 0.25);
});
