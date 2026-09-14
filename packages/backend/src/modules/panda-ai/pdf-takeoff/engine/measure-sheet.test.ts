import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExtractedSheet, Segment, TextRun } from "../types.ts";
import { ASSUMED_CONTEXT, type DocumentContext } from "./document-context.ts";
import { classifySheet, measureSheetRegions } from "./measure-sheet.ts";
import { clusterRegions } from "./cluster.ts";

const MM_PER_PT = 35.28; // 1:100
const pt = (mm: number) => mm / MM_PER_PT;
const seg = (x1: number, y1: number, x2: number, y2: number, width = 0.6): Segment => ({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width, color: "#000" });
const txt = (str: string, x: number, y: number, rotated = false): TextRun => ({ str, x, y, w: str.length * 3, rotated });

// A 9 m x 6 m two-room plan in 225 mm double-line walls at the given page
// offset: enough wall pairs, a partition, room labels and overall dimension
// strings under dimension lines, the way a CAD export prints them.
function plan(ox: number, oy: number, withDims = true): { segments: Segment[]; texts: TextRun[] } {
  const W = pt(9000);
  const D = pt(6000);
  const t = pt(225) / 2;
  const segments: Segment[] = [];
  const box = (x1: number, y1: number, x2: number, y2: number) => {
    segments.push(seg(x1, y1, x2, y1), seg(x1, y2, x2, y2), seg(x1, y1, x1, y2), seg(x2, y1, x2, y2));
  };
  box(ox - t, oy - t, ox + W + t, oy + D + t);
  box(ox + t, oy + t, ox + W - t, oy + D - t);
  // partition at x = 4.5 m
  segments.push(seg(ox + W / 2 - t, oy + t, ox + W / 2 - t, oy + D - t), seg(ox + W / 2 + t, oy + t, ox + W / 2 + t, oy + D - t));
  // enough short strokes that clustering has its filter to apply
  for (let i = 0; i < 40; i++) segments.push(seg(ox + i * 2, oy - 40, ox + i * 2 + 1, oy - 40, 0.1));
  const texts: TextRun[] = [txt("GROUND FLOOR PLAN", ox, oy - 60), txt("LOUNGE", ox + W / 4 - 5, oy + D / 2), txt("KITCHEN", ox + (3 * W) / 4 - 5, oy + D / 2)];
  if (withDims) {
    const dy = oy - pt(1500);
    segments.push(seg(ox, dy, ox + W, dy, 0.1));
    texts.push(txt("9000", ox + W / 2 - 5, dy + 3));
    const dx = ox - pt(1500);
    segments.push(seg(dx, oy, dx, oy + D, 0.1));
    texts.push(txt("6000", dx - 3, oy + D / 2 - 5, true));
  }
  return { segments, texts };
}

const LEVELS: DocumentContext = { ...ASSUMED_CONTEXT, storeyHeightM: 3, storeyHeightBasis: "level-marks" };

function sheetOf(parts: { segments: Segment[]; texts: TextRun[] }[]): ExtractedSheet {
  return { segments: parts.flatMap((p) => p.segments), curves: [], texts: parts.flatMap((p) => p.texts) };
}

test("measureSheetRegions: walls at level-mark height that match the written dimensions are high", () => {
  const { items } = measureSheetRegions(sheetOf([plan(100, 100)]), MM_PER_PT, 0.95, 1, "p1", false, { calibrationMatches: 6, dimUnit: "mm", document: LEVELS });
  const walls = items.filter((i) => /wall/i.test(i.elementGroup));
  assert.equal(walls.length, 1);
  assert.equal(walls[0]!.confidence, "high", walls[0]!.confidenceReason ?? "");
  // 2 x (9 + 6) m perimeter + 6 m partition = 36 m x 3 m = 108 m2; the paired
  // overlap of a mitred box is the inner face, a wall thickness shorter per side
  assert.ok(walls[0]!.qty > 103 && walls[0]!.qty <= 108, `got ${walls[0]!.qty}`);
  assert.match(walls[0]!.measurementBasis, /matches the written dimensions/);
});

test("measureSheetRegions: an assumed storey height is never high, and says so", () => {
  const { items } = measureSheetRegions(sheetOf([plan(100, 100)]), MM_PER_PT, 0.95, 1, "p1", false, { calibrationMatches: 6, dimUnit: "mm", document: ASSUMED_CONTEXT });
  const wall = items.find((i) => /wall/i.test(i.elementGroup))!;
  assert.equal(wall.confidence, "low");
  assert.match(wall.confidenceReason ?? "", /height assumed/);
});

test("measureSheetRegions: a written scale alone never yields a high line", () => {
  const { items } = measureSheetRegions(sheetOf([plan(100, 100)]), MM_PER_PT, 0.6, 1, "p1", false, { calibrationMatches: 0, dimUnit: "mm", document: LEVELS });
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.confidence === "low"));
  assert.match(items[0]!.confidenceReason ?? "", /written scale/);
});

test("measureSheetRegions: walls that disagree with the dimension strings by more than 5% are not high", () => {
  const p = plan(100, 100);
  p.texts = p.texts.map((t) => (t.str === "9000" ? { ...t, str: "9800" } : t));
  const { items } = measureSheetRegions(sheetOf([p]), MM_PER_PT, 0.95, 1, "p1", false, { calibrationMatches: 6, dimUnit: "mm", document: LEVELS });
  const wall = items.find((i) => /wall/i.test(i.elementGroup))!;
  assert.equal(wall.confidence, "low");
  assert.match(wall.confidenceReason ?? "", /disagrees with the written dimensions/);
});

test("measureSheetRegions: two plans on one sheet are both measured, each named", () => {
  const sheet = sheetOf([plan(100, 100), plan(100 + pt(20000), 100)]);
  assert.equal(clusterRegions(sheet, MM_PER_PT).length >= 2, true);
  const { items } = measureSheetRegions(sheet, MM_PER_PT, 0.95, 1, "p1", false, { calibrationMatches: 6, dimUnit: "mm", document: LEVELS });
  const walls = items.filter((i) => /wall/i.test(i.elementGroup));
  assert.equal(walls.length, 2);
  assert.match(walls[0]!.measurementBasis, /drawing 1 of 2/);
  assert.match(walls[1]!.measurementBasis, /drawing 2 of 2/);
});

test("classifySheet: level marks are not titles, so an elevation full of them stays an elevation", () => {
  const texts = [{ str: "+450 GROUND FLOOR LEVEL" }, { str: "+3450 FIRST FLOOR SLAB" }, { str: "NORTH ELEVATION" }];
  assert.deepEqual(classifySheet(texts, false, false), { kind: "elevation", title: "NORTH ELEVATION" });
});
