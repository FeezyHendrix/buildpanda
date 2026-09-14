import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInPolygon, polygonArea, roomAt, simplify } from "./room-at.ts";
import type { GeoSegment, SheetGeometry } from "./types.ts";

// A 4 m × 3 m room drawn as single lines at 1:50 on a PDF (17.64 mm/pt),
// with a 0.9 m door gap in its right wall and a label in the middle.

const MM_PER_PT = 17.64;
const pt = (mm: number) => mm / MM_PER_PT;
const seg = (x1: number, y1: number, x2: number, y2: number, width = 0.6): GeoSegment => ({ x1, y1, x2, y2, width });

function room(opts: { door?: boolean; open?: boolean } = {}): SheetGeometry {
  const w = pt(4000);
  const h = pt(3000);
  const segments = [seg(0, 0, w, 0), seg(0, h, w, h), seg(0, 0, 0, h)];
  if (opts.door) segments.push(seg(w, 0, w, pt(1050)), seg(w, pt(1950), w, h));
  else if (!opts.open) segments.push(seg(w, 0, w, h));
  // a bit of furniture: thin lines that must not cut the room
  segments.push(seg(pt(500), pt(500), pt(1500), pt(500), 0.1), seg(pt(1500), pt(500), pt(1500), pt(1200), 0.1));
  return {
    kind: "pdf",
    segments,
    texts: [
      { str: "LOUNGE", x: pt(1800), y: pt(1500), w: pt(400) },
      { str: "3450", x: pt(1900), y: pt(2500), w: pt(200) },
    ],
    inserts: [],
    outlines: [],
    bounds: { minX: -pt(2000), minY: -pt(2000), maxX: w + pt(2000), maxY: h + pt(2000) },
  };
}

test("roomAt: a closed rectangle comes back as its four corners, its area and its label", () => {
  const r = roomAt(room(), [pt(2000), pt(1500)], MM_PER_PT, { penPt: 0.5 });
  assert.ok(r, "expected a room");
  assert.equal(r.label, "LOUNGE");
  assert.ok(Math.abs(r.areaM2 - 12) / 12 < 0.03, `area ${r.areaM2}`);
  assert.equal(r.vertices.length, 4, `vertices ${JSON.stringify(r.vertices)}`);
  for (const [x, y] of r.vertices) {
    assert.ok(Math.abs(x!) < pt(60) || Math.abs(x! - pt(4000)) < pt(60), `x ${x}`);
    assert.ok(Math.abs(y!) < pt(60) || Math.abs(y! - pt(3000)) < pt(60), `y ${y}`);
  }
});

test("roomAt: a door gap is sealed by the closing pass, so the room still fills", () => {
  const r = roomAt(room({ door: true }), [pt(2000), pt(1500)], MM_PER_PT, { penPt: 0.5 });
  assert.ok(r, "expected a room");
  assert.ok(Math.abs(r.areaM2 - 12) / 12 < 0.05, `area ${r.areaM2}`);
});

test("roomAt: a space open to the outside is not a room", () => {
  assert.equal(roomAt(room({ open: true }), [pt(2000), pt(1500)], MM_PER_PT, { penPt: 0.5 }), null);
});

test("roomAt: a click on a wall line still finds the room beside it; far outside finds nothing", () => {
  const onWall = roomAt(room(), [0, pt(1500)], MM_PER_PT, { penPt: 0.5 });
  assert.ok(onWall && Math.abs(onWall.areaM2 - 12) / 12 < 0.05);
  assert.equal(roomAt(room(), [pt(9000), pt(9000)], MM_PER_PT, { penPt: 0.5 }), null);
});

test("simplify and polygon helpers", () => {
  const stair = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [0, 3]];
  const simple = simplify(stair, 1);
  assert.ok(simple.length < stair.length);
  assert.equal(polygonArea([[0, 0], [4, 0], [4, 3], [0, 3]]), 12);
  assert.equal(pointInPolygon(2, 1, [[0, 0], [4, 0], [4, 3], [0, 3]]), true);
  assert.equal(pointInPolygon(5, 1, [[0, 0], [4, 0], [4, 3], [0, 3]]), false);
});
