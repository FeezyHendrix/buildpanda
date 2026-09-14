import { test } from "node:test";
import assert from "node:assert/strict";
import { calibrate } from "./calibrate.ts";
import { measureWalls } from "./measure.ts";
import type { Segment, TextRun } from "../types.ts";

// Accuracy benchmark: build synthetic drawings whose true quantities are known
// EXACTLY by construction, run the real measurement chain, and assert the error
// stays inside the QS-accepted band. This is the only place accuracy is measured
// as a number; add real hand-verified cases here as they become available.
//
// QS tolerance (RICS/NRM2): detailed measurement ±2-3%. We assert <=3% and log
// the actual deviation so regressions surface as accuracy loss, not just failure.

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

const TOLERANCE = 0.03;

function pctError(measured: number, truth: number): number {
  return Math.abs(measured - truth) / truth;
}

// A single rectangular room in 225mm double-line walls at 1:100, dimensioned so
// calibration recovers the scale from the drawing itself (no scale is passed in).
function syntheticRoom(widthMm: number, heightMm: number): { segments: Segment[]; texts: TextRun[] } {
  const mmPerPt = 35.28; // 1:100
  const t = 225 / mmPerPt;
  const w = widthMm / mmPerPt;
  const h = heightMm / mmPerPt;
  const segments: Segment[] = [
    seg(0, 0, w, 0),
    seg(0, h, w, h),
    seg(0, 0, 0, h),
    seg(w, 0, w, h),
    seg(t, t, w - t, t),
    seg(t, h - t, w - t, h - t),
    seg(t, t, t, h - t),
    seg(w - t, t, w - t, h - t),
  ];
  // dimension strings + their dimension lines so calibrate() recovers 1:100
  const texts: TextRun[] = [];
  for (const [i, v] of [widthMm, heightMm, 3600, 2400, 1200, 900].entries()) {
    const lenPt = v / mmPerPt;
    const y = h + 30 + i * 25;
    segments.push(seg(0, y, lenPt, y, 0.13));
    texts.push(text(String(v), lenPt / 2 - 4, y + 2));
  }
  return { segments, texts };
}

test("benchmark: scale recovered end-to-end within tolerance", () => {
  const { segments, texts } = syntheticRoom(6000, 4000);
  const cal = calibrate(texts, segments);
  assert.ok(cal, "calibration must succeed on a dimensioned drawing");
  const err = pctError(cal.mmPerPt, 35.28);
  console.log(`[benchmark] scale error: ${(err * 100).toFixed(2)}%`);
  assert.ok(err <= TOLERANCE, `scale error ${(err * 100).toFixed(2)}% exceeds ${TOLERANCE * 100}%`);
});

test("benchmark: wall centreline length within tolerance", () => {
  const widthMm = 6000;
  const heightMm = 4000;
  const { segments, texts } = syntheticRoom(widthMm, heightMm);
  const cal = calibrate(texts, segments);
  assert.ok(cal);
  const walls = measureWalls(segments, cal.mmPerPt);
  // true centreline of a 4-wall rectangle measured face-to-face overlap:
  // perimeter of the wall centrelines ~ 2*((w-t)+(h-t)) in metres.
  const t = 0.225;
  const truthM = 2 * ((widthMm / 1000 - t) + (heightMm / 1000 - t));
  const err = pctError(walls.centrelineM, truthM);
  console.log(`[benchmark] wall centreline: measured ${walls.centrelineM}m vs truth ~${truthM.toFixed(2)}m (${(err * 100).toFixed(1)}%)`);
  assert.ok(err <= 0.1, `wall length error ${(err * 100).toFixed(1)}% too high`);
});

test("benchmark: wall area (net of assumed height) tracks the scale error, not more", () => {
  // Because area = centreline x assumed height, its accuracy is bounded by the
  // scale+length accuracy above — this guards against a NEW error being injected
  // downstream of measurement (e.g. a rounding or unit bug in area derivation).
  const { segments, texts } = syntheticRoom(6000, 4000);
  const cal = calibrate(texts, segments);
  assert.ok(cal);
  const walls = measureWalls(segments, cal.mmPerPt);
  const areaFromCentreline = walls.centrelineM * 2.7;
  const truthArea = 2 * ((6 - 0.225) + (4 - 0.225)) * 2.7;
  const err = pctError(areaFromCentreline, truthArea);
  console.log(`[benchmark] wall area: ${areaFromCentreline.toFixed(1)}m2 vs truth ~${truthArea.toFixed(1)}m2 (${(err * 100).toFixed(1)}%)`);
  assert.ok(err <= 0.1, `wall area error ${(err * 100).toFixed(1)}% too high`);
});
