import { test } from "node:test";
import assert from "node:assert/strict";
import { symbolMatches } from "./symbol-matches.ts";
import { sheetPrimitives } from "../dwg-takeoff/sheet-primitives.ts";
import { synth } from "../dwg-takeoff/fixtures.ts";
import { closedOutlines } from "./pdf-primitives.ts";
import type { Segment, SheetGeometry } from "./types.ts";

// DWG: a symbol is a block; boxing one door names its block and every
// insert of that block is a match. PDF: a symbol is an outline; boxing one
// finds every outline of the same vertex count, proportions and size.

function dwgSheet(): SheetGeometry {
  const s = synth();
  const door = s.block("DOOR-900", [{ entity: "LINE", start: [0, 0], end: [900, 0] }]);
  const wc = s.block("WC", [{ entity: "LWPOLYLINE", points: [[0, 0], [400, 0], [400, 600], [0, 600]], flag: 512 }]);
  s.insert("DOORS", door, [1000, 0]);
  s.insert("DOORS", door, [5000, 0], { rotation: Math.PI / 2 });
  s.insert("DOORS", door, [9000, 3000]);
  s.insert("SANITARY", wc, [2000, 2000]);
  s.insert("SANITARY", wc, [6000, 2000]);
  s.text("TEXT", [3000, 1000], "LOUNGE");
  s.rect("WALL", -500, -500, 12000, 8000);
  const p = sheetPrimitives(s.doc(), null);
  return { kind: "dwg", ...p, bounds: null };
}

test("DWG: the inserts in the box name the block and every insert of that name is returned", () => {
  const geo = dwgSheet();
  const found = symbolMatches(geo, [900, -100, 1100, 100]);
  assert.ok(found);
  assert.equal(found.name, "DOOR-900");
  assert.equal(found.count, 3);
  assert.deepEqual(found.points, [[1000, 0], [5000, 0], [9000, 3000]]);
});

test("DWG: excludeSeed leaves out the boxed insert; a box with nothing in it is null", () => {
  const geo = dwgSheet();
  const found = symbolMatches(geo, [1900, 1900, 2100, 2100], { excludeSeed: true });
  assert.ok(found);
  assert.equal(found.name, "WC");
  assert.deepEqual(found.points, [[6000, 2000]]);
  assert.equal(symbolMatches(geo, [20000, 20000, 20100, 20100]), null);
});

test("DWG primitives: block contents are placed as segments, texts keep their label, closed polylines become outlines", () => {
  const geo = dwgSheet();
  assert.ok(geo.segments.length >= 3 + 4 * 2 + 4, `segments ${geo.segments.length}`);
  assert.ok(geo.texts.some((t) => t.str === "LOUNGE"));
  assert.ok(geo.outlines.length >= 3, "the wall rectangle and two placed WC outlines");
  assert.equal(geo.inserts.length, 5);
});

const segsOf = (path: number, pts: number[][], width = 0.3): Segment[] =>
  pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return { x1: p[0]!, y1: p[1]!, x2: q[0]!, y2: q[1]!, len: Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!), width, color: "#000", path, closed: true };
  });

function pdfSheet(): SheetGeometry {
  const rectAt = (x: number, y: number, w: number, h: number): number[][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const segments = [
    ...segsOf(1, rectAt(10, 10, 20, 30)), // the seed: 20 × 30
    ...segsOf(2, rectAt(100, 10, 30, 20)), // same symbol rotated
    ...segsOf(3, rectAt(200, 10, 21, 31)), // within 10 %
    ...segsOf(4, rectAt(300, 10, 40, 60)), // twice the size: a different symbol
    ...segsOf(5, [[400, 10], [420, 10], [410, 40]]), // a triangle
    ...segsOf(6, rectAt(0, 0, 500, 500)), // the room outline
  ];
  return { kind: "pdf", segments, texts: [], inserts: [], outlines: closedOutlines(segments), bounds: null };
}

test("PDF: the outline in the box gives a signature and every outline with it matches, orientation-free", () => {
  const found = symbolMatches(pdfSheet(), [5, 5, 35, 45]);
  assert.ok(found);
  assert.equal(found.name, null);
  assert.equal(found.count, 3);
  assert.deepEqual(found.points, [[20, 25], [115, 20], [210.5, 25.5]]);
  const rest = symbolMatches(pdfSheet(), [5, 5, 35, 45], { excludeSeed: true });
  assert.equal(rest?.count, 2);
});

test("PDF: an outline only partly inside the box is not a seed", () => {
  assert.equal(symbolMatches(pdfSheet(), [5, 5, 25, 25]), null);
});
