import { test } from "node:test";
import assert from "node:assert/strict";
import { measureWallRuns, wallSegments, type WallSegment } from "./walls.ts";
import { synth } from "./fixtures.ts";
import type { RegisterSheet } from "./types.ts";

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ handle: 1, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });

test("two jambed openings in a wall are bridged: the centreline runs through them", () => {
  // faces at y=0 and y=230 cut at 3000–3900 (door) and 6000–7200 (window), jambs closing each cut
  const faces = [0, 230].flatMap((y) => [seg(0, y, 3000, y), seg(3900, y, 6000, y), seg(7200, y, 10000, y)]);
  const jambs = [3000, 3900, 6000, 7200].map((x) => seg(x, 0, x, 230));
  const m = measureWallRuns([...faces, ...jambs], 1);
  assert.equal(m.byThickness.get(225)!.lengthM, 10);
  assert.equal(m.bridgedM, 2.1);
  assert.equal(m.unpairedM, 0, "jambs are not lost wall");
});

test("a gap with no jamb and no opening in it stays a gap; an opening element bridges it without jambs", () => {
  const faces = [0, 230].flatMap((y) => [seg(0, y, 4000, y), seg(4900, y, 10000, y)]);
  assert.equal(measureWallRuns(faces, 1).byThickness.get(225)!.lengthM, 9.1);
  const withDoor = measureWallRuns(faces, 1, [[4450, 680]]);
  assert.equal(withDoor.byThickness.get(225)!.lengthM, 10);
  const farDoor = measureWallRuns(faces, 1, [[4450, 3000]]);
  assert.equal(farDoor.byThickness.get(225)!.lengthM, 9.1, "a door on another wall is not this wall's opening");
});

test("a multi-bay external wall drawn bay by bay with a window per bay measures as one run", () => {
  const segs: WallSegment[] = [];
  for (let bay = 0; bay < 3; bay++) {
    const x0 = bay * 4000;
    const [wa, wb] = [x0 + 1400, x0 + 2600];
    for (const y of [0, 230]) segs.push(seg(x0, y, wa, y), seg(wb, y, x0 + 4000, y));
    segs.push(seg(wa, 0, wa, 230), seg(wb, 0, wb, 230));
  }
  const m = measureWallRuns(segs, 1);
  assert.equal(m.byThickness.get(225)!.lengthM, 12);
  assert.equal(m.bridgedM, 3.6);
});

test("a T-junction: the internal wall's faces pair with each other, not with the external face they meet", () => {
  const external = [seg(0, 0, 10000, 0), seg(0, 230, 10000, 230)];
  const internal = [seg(5000, 230, 5000, 4230), seg(5150, 230, 5150, 4230)];
  const m = measureWallRuns([...external, ...internal], 1);
  assert.equal(m.byThickness.get(225)!.lengthM, 10);
  assert.equal(m.byThickness.get(150)!.lengthM, 4);
});

test("a wall drawn as one closed polyline outline measures its long sides once and ignores the end caps", () => {
  const s = synth();
  s.rect("WALL", 0, 0, 8000, 230);
  const doc = s.doc();
  const sheet = { members: doc.entities.map((_, i) => i) } as RegisterSheet;
  const m = measureWallRuns(wallSegments(doc, sheet, { WALL: "walls" }), 1);
  assert.equal(m.byThickness.get(225)!.lengthM, 8);
  assert.equal(m.unpairedM, 0);
});
