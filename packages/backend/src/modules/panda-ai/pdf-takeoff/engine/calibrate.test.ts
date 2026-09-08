import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrate } from "./calibrate.ts";
import type { Segment, TextRun } from "../types.ts";

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

test("calibrate: feet-and-inches dimensions snap to the imperial scale set, and a written 1/8\" = 1'-0\" reads as 1:96", () => {
  // at 1:96 a point is 33.87 mm; 14'-9 1/8" (4500.6 mm) is a 132.9 pt line
  const mmPerPt = 96 * PT_TO_MM;
  const segments: Segment[] = [];
  const texts: TextRun[] = [];
  const dims: Array<[string, number]> = [[`14'-9 1/8"`, 4500.6], [`10'-9 7/8"`, 3300.7], [`11'-9 3/4"`, 3600.4], [`13'-9 3/8"`, 4200.5]];
  dims.forEach(([str, mm], i) => {
    const y = 100 + i * 40;
    const len = mm / mmPerPt;
    segments.push({ x1: 50, y1: y, x2: 50 + len, y2: y, len, width: 0.1, color: "#000" });
    texts.push({ str, x: 50 + len / 2 - 8, y: y - 4, w: 16, rotated: false });
  });
  const cal = calibrate(texts, segments);
  assert.ok(cal, "calibrates from imperial strings");
  assert.equal(Math.round(cal!.mmPerPt / PT_TO_MM), 96);
  assert.ok(cal!.matches >= 3);
  const written = calibrate([txt(`SCALE: 1/8" = 1'-0"`), txt("FLOOR PLAN")], []);
  assert.equal(Math.round(written!.mmPerPt / PT_TO_MM), 96);
  assert.equal(Math.round(calibrate([txt(`1/4" = 1'-0"`)], [])!.mmPerPt / PT_TO_MM), 48);
});

test("calibrate: a revision-label ratio (1:5) is not treated as a drawing scale", () => {
  const cal = calibrate([txt("rev 1:5"), txt("FLOOR PLAN")], []);
  assert.equal(cal, null);
});
