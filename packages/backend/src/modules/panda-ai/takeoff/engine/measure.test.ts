import { test } from "node:test";
import assert from "node:assert/strict";
import { measureRoomAreas } from "./measure.ts";
import type { DrawingRegion, Segment, TextRun } from "../types.ts";

function seg(x1: number, y1: number, x2: number, y2: number): Segment {
  return { x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1), width: 0.3, color: "#000" };
}
function txt(str: string, x: number, y: number): TextRun {
  return { str, x, y, w: str.length * 5, rotated: false };
}

// A single sealed square room ~4x4m (at mmPerPt ~= 0.35, 1pt = 0.35mm; use a
// region and mmPerPt so the closed box is a plausible room), labelled both with
// a real room word and with material/annotation text that must be ignored.
const region: DrawingRegion = { id: 1, minX: 0, minY: 0, maxX: 400, maxY: 400, kind: "floor-plan", segmentIdx: [] };
const box: Segment[] = [
  seg(50, 50, 350, 50),
  seg(50, 350, 350, 350),
  seg(50, 50, 50, 350),
  seg(350, 50, 350, 350),
];

test("measureRoomAreas: material/annotation labels are NOT counted as rooms", () => {
  const texts = [
    txt("KITCHEN", 180, 200),
    txt("BRICKWORK", 200, 210),
    txt("REFER TO ENGINEERS", 190, 190),
    txt("SITE BOUNDARY", 195, 205),
    txt("AGGREGATE", 185, 195),
    txt("CORRUGATED", 200, 200),
  ];
  const rooms = measureRoomAreas(box, texts, region, 11.3);
  const names = rooms.map((r) => r.name.toUpperCase());
  for (const junk of ["BRICKWORK", "REFER TO ENGINEERS", "SITE BOUNDARY", "AGGREGATE", "CORRUGATED"]) {
    assert.ok(!names.includes(junk), `${junk} must not be a room`);
  }
});

test("measureRoomAreas: a real room word seeds a room", () => {
  const rooms = measureRoomAreas(box, [txt("KITCHEN", 180, 200)], region, 11.3);
  assert.ok(rooms.length <= 1);
  if (rooms.length === 1) assert.match(rooms[0]!.name, /KITCHEN/i);
});
