import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrate } from "./calibrate.ts";
import type { TextRun } from "../types.ts";

function txt(str: string, x = 0, y = 0): TextRun {
  return { str, x, y, w: str.length * 5, rotated: false };
}

const PT_TO_MM = 0.3528;

test("calibrate: reads the stated scale when dimension-line geometry is absent", () => {
  // A sheet with dimension strings but no matchable dimension-line geometry —
  // the drawing states "SCALE 1 : 100", which must be trusted.
  const texts = [txt("SCALE: 1 : 100"), txt("5550"), txt("4265"), txt("GROUND FLOOR PLAN")];
  const cal = calibrate(texts, []);
  assert.ok(cal, "should calibrate from stated scale");
  assert.equal(Math.round(cal!.mmPerPt / PT_TO_MM), 100);
});

test("calibrate: accepts a non-standard stated scale (1:120)", () => {
  const cal = calibrate([txt("SCALE 1:120"), txt("FLOOR PLAN")], []);
  assert.ok(cal);
  assert.equal(Math.round(cal!.mmPerPt / PT_TO_MM), 120);
});

test("calibrate: no scale text and no dimension lines -> null (refuse)", () => {
  const cal = calibrate([txt("FLOOR PLAN"), txt("KITCHEN"), txt("BEDROOM")], []);
  assert.equal(cal, null);
});

test("calibrate: a revision-label ratio (1:5) is not treated as a drawing scale", () => {
  const cal = calibrate([txt("rev 1:5"), txt("FLOOR PLAN")], []);
  assert.equal(cal, null);
});
