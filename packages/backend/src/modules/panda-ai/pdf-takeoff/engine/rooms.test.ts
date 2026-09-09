import { test } from "node:test";
import assert from "node:assert/strict";
import type { DrawingRegion, Segment, TextRun } from "../types.ts";
import { measureRooms } from "./rooms.ts";

const MM_PER_PT = 35.28;
const pt = (mm: number) => mm / MM_PER_PT;
const seg = (x1: number, y1: number, x2: number, y2: number, width = 0.6): Segment => ({ x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width, color: "#000" });
const txt = (str: string, x: number, y: number): TextRun => ({ str, x, y, w: 10, rotated: false });

// Two rooms 4 m x 3 m side by side, sharing a wall with a 0.9 m door gap in
// the middle; the enclosure is drawn as single lines at the room faces.
function twoRooms(): { segments: Segment[]; region: DrawingRegion; bridge: Segment } {
  const w = pt(4000);
  const h = pt(3000);
  const gapLo = pt(1050);
  const gapHi = pt(1950);
  const segments = [
    seg(0, 0, 2 * w, 0),
    seg(0, h, 2 * w, h),
    seg(0, 0, 0, h),
    seg(2 * w, 0, 2 * w, h),
    seg(w, 0, w, gapLo),
    seg(w, gapHi, w, h),
  ];
  const region: DrawingRegion = { id: 0, minX: -5, minY: -5, maxX: 2 * w + 5, maxY: h + 5, kind: "floor-plan", segmentIdx: [] };
  return { segments, region, bridge: seg(w, gapLo, w, gapHi, 1) };
}

test("measureRooms: a bridged door opening keeps the two rooms apart and each within 1% of 12 m2", () => {
  const { segments, region, bridge } = twoRooms();
  const w = pt(4000);
  const { rooms, unfilled } = measureRooms(segments, [txt("LOUNGE", w / 2 - 5, pt(1500)), txt("DINING", w * 1.5 - 5, pt(1500))], region, MM_PER_PT, { penPt: 0.6, bridges: [bridge] });
  assert.deepEqual(unfilled, []);
  assert.equal(rooms.length, 2);
  for (const r of rooms) {
    assert.ok(Math.abs(r.areaM2 - 12) / 12 < 0.01, `${r.name} ${r.areaM2}`);
    assert.equal(r.sealed, false);
  }
});

test("measureRooms: without a bridge the fill runs into the next room's label, so the sealing pass takes over", () => {
  const { segments, region } = twoRooms();
  const w = pt(4000);
  const { rooms } = measureRooms(segments, [txt("LOUNGE", w / 2 - 5, pt(1500)), txt("DINING", w * 1.5 - 5, pt(1500))], region, MM_PER_PT, { penPt: 0.6 });
  assert.equal(rooms.length, 2, "both rooms survive by sealing the door");
  assert.ok(rooms.every((r) => r.sealed));
  for (const r of rooms) assert.ok(Math.abs(r.areaM2 - 12) / 12 < 0.06, `${r.name} ${r.areaM2}`);
});

test("measureRooms: a label whose room leaks to the region edge is reported, not silently dropped", () => {
  const { segments, region } = twoRooms();
  const open = segments.filter((s) => !(s.y1 === 0 && s.y2 === 0)); // remove the whole top wall
  const { rooms, unfilled } = measureRooms(open, [txt("LOUNGE", pt(2000), pt(1500))], region, MM_PER_PT, { penPt: 0.6 });
  assert.equal(rooms.length, 0);
  assert.deepEqual(unfilled, ["LOUNGE"]);
});

test("measureRooms: numbered and lift/dressing labels seed rooms", () => {
  const { segments, region, bridge } = twoRooms();
  const w = pt(4000);
  const { rooms } = measureRooms(segments, [txt("OFFICE 12", w / 2 - 5, pt(1500)), txt("DRESSING", w * 1.5 - 5, pt(1500))], region, MM_PER_PT, { penPt: 0.6, bridges: [bridge] });
  assert.deepEqual(rooms.map((r) => r.name).sort(), ["DRESSING", "OFFICE 12"]);
});
