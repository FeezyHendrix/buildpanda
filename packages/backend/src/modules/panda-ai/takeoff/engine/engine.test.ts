import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { calibrate } from "./calibrate.ts";
import { clusterRegions } from "./cluster.ts";
import { countDoorArcs, countTags, measureRoomAreas, measureWalls } from "./measure.ts";
import { draftBoq } from "./boq-draft.ts";
import { buildSnapIndex } from "./pdf-extract.ts";
import type { Curve, DrawingRegion, MeasuredBoqItem, Segment, TextRun } from "../types.ts";

const seg = (x1: number, y1: number, x2: number, y2: number, width = 0.2): Segment => ({
  x1,
  y1,
  x2,
  y2,
  len: Math.hypot(x2 - x1, y2 - y1),
  width,
  color: "#000000",
});

const text = (str: string, x: number, y: number, w = 10, rotated = false): TextRun => ({ str, x, y, w, rotated });

// ---------- calibration ----------

test("calibrate: recovers scale from dimension annotations and infers cm", () => {
  // 1:50 drawing dimensioned in cm -> true scale 17.64 mm/pt, raw ratio 1.764
  const mmPerPt = 17.64;
  const segments: Segment[] = [];
  const texts: TextRun[] = [];
  // ten horizontal dimension lines: value v cm over a line of v*10/17.64 pt
  const values = [500, 333, 460, 1373, 147, 900, 1200, 250, 610, 780];
  values.forEach((v, i) => {
    const lenPt = (v * 10) / mmPerPt;
    const y = 100 + i * 30;
    segments.push(seg(50, y, 50 + lenPt, y, 0.13));
    texts.push(text(String(v), 50 + lenPt / 2 - 5, y + 3));
  });
  // noise: unrelated segments
  for (let i = 0; i < 20; i++) segments.push(seg(400, i * 11, 700, i * 11 + 5));
  const result = calibrate(texts, segments);
  assert.ok(result, "calibration should succeed");
  assert.equal(result.dimUnit, "cm");
  assert.ok(Math.abs(result.mmPerPt - mmPerPt) / mmPerPt < 0.03, `expected ~${mmPerPt}, got ${result.mmPerPt}`);
  assert.ok(result.confidence >= 0.7);
});

test("calibrate: mm dimensions at 1:100 infer mm", () => {
  const mmPerPt = 35.28; // 1:100
  const segments: Segment[] = [];
  const texts: TextRun[] = [];
  for (const [i, v] of [3600, 4500, 2400, 1200, 5100, 900].entries()) {
    const lenPt = v / mmPerPt;
    const y = 50 + i * 25;
    segments.push(seg(10, y, 10 + lenPt, y, 0.13));
    texts.push(text(String(v), 10 + lenPt / 2 - 4, y + 2));
  }
  const result = calibrate(texts, segments);
  assert.ok(result);
  assert.equal(result.dimUnit, "mm");
  assert.ok(Math.abs(result.mmPerPt - mmPerPt) / mmPerPt < 0.03);
});

test("calibrate: refuses noise", () => {
  const segments = [seg(0, 0, 100, 0), seg(0, 10, 37, 10), seg(0, 20, 81, 20)];
  const texts = [text("500", 500, 500), text("1200", 700, 700)];
  assert.equal(calibrate(texts, segments), null);
});

test("calibrate: snaps a slightly-off ratio to the exact standard scale", () => {
  const trueScale = 35.28; // 1:100
  const drawn = trueScale * 0.96; // dimension lines drawn ~4% short (imprecise CAD/scan)
  const segments: Segment[] = [];
  const texts: TextRun[] = [];
  for (const [i, v] of [3600, 4500, 2400, 1200, 5100, 900].entries()) {
    const lenPt = v / drawn;
    const y = 50 + i * 25;
    segments.push(seg(10, y, 10 + lenPt, y, 0.13));
    texts.push(text(String(v), 10 + lenPt / 2 - 4, y + 2));
  }
  const result = calibrate(texts, segments);
  assert.ok(result);
  // Snapped to the exact 1:100 scale, NOT the ~4%-off measured value.
  assert.ok(Math.abs(result.mmPerPt - trueScale) < 0.01, `expected snap to ${trueScale}, got ${result.mmPerPt}`);
});

// ---------- walls ----------

test("measureWalls: 4x3m room in 225mm double-line walls", () => {
  const mmPerPt = 17.64;
  const t = 225 / mmPerPt; // wall thickness in pt
  const w = 4000 / mmPerPt;
  const h = 3000 / mmPerPt;
  // outer rectangle + inner rectangle (double-line walls)
  const segments = [
    // outer
    seg(0, 0, w, 0),
    seg(0, h, w, h),
    seg(0, 0, 0, h),
    seg(w, 0, w, h),
    // inner
    seg(t, t, w - t, t),
    seg(t, h - t, w - t, h - t),
    seg(t, t, t, h - t),
    seg(w - t, t, w - t, h - t),
  ];
  const walls = measureWalls(segments, mmPerPt);
  assert.equal(walls.pairs.length, 4);
  // centreline: overlaps of paired faces — near 2*(4+3)=14m, slightly less from corners
  assert.ok(walls.centrelineM > 12 && walls.centrelineM <= 14.5, `got ${walls.centrelineM}`);
});

test("measureWalls: ignores thin pens and isolated lines", () => {
  const segments = [
    seg(0, 0, 500, 0, 0.05), // hairline: not a wall pen
    seg(0, 100, 500, 100, 0.05),
    seg(0, 300, 500, 300), // no parallel partner in range
  ];
  assert.equal(measureWalls(segments, 17.64).centrelineM, 0);
});

test("measureWalls: a wall face split by openings is annotated as one full run", () => {
  const mmPerPt = 17.64;
  const t = 225 / mmPerPt; // wall thickness in pt
  const total = 8000 / mmPerPt; // 8m wall
  const door = 900 / mmPerPt; // a door opening splits the face
  // Each face is drawn as three collinear fragments broken by a door gap.
  const frag = (y: number) => [
    seg(0, y, 3000 / mmPerPt, y),
    seg(3000 / mmPerPt + door, y, 5500 / mmPerPt, y),
    seg(5500 / mmPerPt + door, y, total, y),
  ];
  const segments = [...frag(0), ...frag(t)];
  const walls = measureWalls(segments, mmPerPt);
  // Fragments merge into ONE run per face, then pair into one wall.
  assert.equal(walls.pairs.length, 1, `expected 1 merged wall, got ${walls.pairs.length}`);
  const [p] = walls.pairs;
  // Annotation must span the whole wall (~8m), not just a 3m fragment.
  const spanPt = p!.vertices[1]![0]! - p!.vertices[0]![0]!;
  const spanM = (spanPt * mmPerPt) / 1000;
  assert.ok(spanM > 7.5 && spanM <= 8.1, `annotation span should cover full wall, got ${spanM}m`);
});

// ---------- doors + tags ----------

function quarterArc(cx: number, cy: number, r: number): Curve {
  // cubic bezier approximation of a quarter circle, kappa = 0.5523
  const k = 0.5523 * r;
  return {
    sx: cx + r,
    sy: cy,
    c1x: cx + r,
    c1y: cy + k,
    c2x: cx + k,
    c2y: cy + r,
    ex: cx,
    ey: cy + r,
    width: 0.2,
    color: "#000000",
  };
}

test("countDoorArcs: finds quarter-circle swings in leaf-width range", () => {
  const mmPerPt = 17.64;
  const r = 900 / mmPerPt; // 900mm leaf
  const curves = [
    quarterArc(100, 100, r),
    quarterArc(300, 300, r),
    quarterArc(500, 500, 100 / mmPerPt), // 100mm: too small — furniture arc
  ];
  const { count } = countDoorArcs(curves, mmPerPt);
  assert.equal(count, 2);
});

test("countTags: groups W/D tags by type", () => {
  const texts = [
    text("W11", 0, 0),
    text("W11", 10, 10),
    text("W-4", 20, 20),
    text("D5", 30, 30),
    text("d5", 40, 40),
    text("DRAWING", 50, 50),
    text("W123456", 60, 60), // too many digits
  ];
  const { windows, doors } = countTags(texts);
  assert.equal(windows.get("W11")?.length, 2);
  assert.equal(windows.get("W4")?.length, 1);
  assert.equal(doors.get("D5")?.length, 2);
  assert.equal(windows.size, 2);
  assert.equal(doors.size, 1);
});

// ---------- rooms ----------

test("measureRoomAreas: flood fill recovers a 4x3m room", () => {
  const mmPerPt = 17.64;
  const w = 4000 / mmPerPt;
  const h = 3000 / mmPerPt;
  const pad = 40;
  const segments = [
    seg(pad, pad, pad + w, pad),
    seg(pad, pad + h, pad + w, pad + h),
    seg(pad, pad, pad, pad + h),
    seg(pad + w, pad, pad + w, pad + h),
  ];
  const region: DrawingRegion = {
    id: 0,
    minX: 0,
    minY: 0,
    maxX: pad * 2 + w,
    maxY: pad * 2 + h,
    kind: "floor-plan",
    segmentIdx: [],
  };
  const rooms = measureRoomAreas(segments, [text("BEDROOM", pad + w / 2 - 10, pad + h / 2)], region, mmPerPt);
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0]!.name, "BEDROOM");
  // closing intrudes ~50mm/wall; accept 9.5-12.5 m2 around true 12
  assert.ok(rooms[0]!.areaM2 > 9.5 && rooms[0]!.areaM2 < 12.5, `got ${rooms[0]!.areaM2}`);
});

test("measureRoomAreas: unbounded label leaks and is dropped", () => {
  const mmPerPt = 17.64;
  const region: DrawingRegion = { id: 0, minX: 0, minY: 0, maxX: 500, maxY: 400, kind: "floor-plan", segmentIdx: [] };
  const rooms = measureRoomAreas([seg(0, 0, 500, 0)], [text("KITCHEN", 250, 200)], region, mmPerPt);
  assert.equal(rooms.length, 0);
});

// ---------- clustering + drafting ----------

test("clusterRegions: separates two distant drawings", () => {
  const a = Array.from({ length: 40 }, (_, i) => seg(i * 4, 0, i * 4 + 3, 3));
  const b = Array.from({ length: 40 }, (_, i) => seg(2000 + i * 4, 2000, 2000 + i * 4 + 3, 2003));
  const regions = clusterRegions({ segments: [...a, ...b], curves: [], texts: [] });
  assert.equal(regions.length, 2);
});

test("draftBoq: structure order, net math, geometry attribution", () => {
  const items: MeasuredBoqItem[] = [
    {
      elementGroup: "Walls",
      workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
      specNote: "Sandcrete blocks",
      code: "F10/125",
      description: "225mm blockwork",
      unit: "m2",
      qtyGross: 52,
      deductions: [{ label: "Door D1", qty: 5.8 }],
      qty: 46.2,
      confidence: "high",
      measurementBasis: "test",
      geometries: [{ kind: "linear", vertices: [[0, 0], [10, 0]], quantity: 10, unit: "m" }],
      pageNumber: 1,
    },
  ];
  const { bills, rows, geometries } = draftBoq("pcs_1", items, new Map([[1, "pcsh_1"]]));
  assert.equal(bills.length, 2);
  const types = rows.map((r) => r.row_type);
  assert.ok(types.indexOf("heading") < types.indexOf("work_section"));
  const item = rows.find((r) => r.row_type === "item" && r.code === "F10/125")!;
  assert.equal(Number(item.qty_gross) - item.deductions.reduce((s, d) => s + d.qty, 0), Number(item.qty));
  assert.equal(item.status, "ai_generated");
  assert.equal(geometries.length, 1);
  assert.equal(geometries[0]!.sheet_id, "pcsh_1");
  assert.equal(geometries[0]!.row_id, item.id);
  // prelims items are unpriced drafts
  const prelims = rows.filter((r) => r.bill_id === bills[0]!.id && r.row_type === "item");
  assert.ok(prelims.length >= 10);
  assert.ok(prelims.every((r) => r.qty === null && r.rate === null));
});

test("buildSnapIndex dedupes endpoints", () => {
  const points = buildSnapIndex([seg(0, 0, 10, 0), seg(10, 0, 10, 10)]);
  assert.equal(points.length, 3);
});

// ---------- golden test on the real sample (skipped when absent) ----------

const SAMPLE = "/Users/drhendrix/Downloads/36472-1._architectural_final.pdf";

test("golden: sample architectural PDF page 2", { skip: !fs.existsSync(SAMPLE) }, async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { extractSheet } = await import("./pdf-extract.ts");
  const doc = await pdfjs.getDocument({ url: SAMPLE, useSystemFonts: true }).promise;
  const page = await doc.getPage(2);
  const extracted = await extractSheet(page as never, pdfjs.OPS as never);
  assert.ok(extracted.segments.length > 10000, `segments: ${extracted.segments.length}`);

  const calibration = calibrate(extracted.texts, extracted.segments);
  assert.ok(calibration, "sample must calibrate");
  assert.equal(calibration.dimUnit, "cm");
  assert.ok(Math.abs(calibration.mmPerPt - 17.68) < 0.5, `scale: ${calibration.mmPerPt}`);

  const { windows, doors } = countTags(extracted.texts);
  assert.equal(windows.get("W11")?.length, 7);
  assert.equal(doors.get("D5")?.length, 3);

  const walls = measureWalls(extracted.segments, calibration.mmPerPt);
  assert.ok(walls.centrelineM > 200 && walls.centrelineM < 600, `centreline: ${walls.centrelineM}`);
  await doc.cleanup();
});
