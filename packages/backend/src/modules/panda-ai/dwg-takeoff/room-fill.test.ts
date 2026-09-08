import { test } from "node:test";
import assert from "node:assert/strict";
import { fillRooms } from "./room-fill.ts";
import type { WallSegment } from "./walls.ts";

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ handle: null, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
const bounds = { minX: -500, minY: -500, maxX: 8500, maxY: 6500 };

// a 4 × 3 m room (inner faces) beside a 4 × 3 m room, a 900 door between them
function twoRooms(): { walls: WallSegment[]; door: [number, number] } {
  const walls = [
    seg(0, 0, 8000, 0),
    seg(8000, 0, 8000, 3000),
    seg(8000, 3000, 0, 3000),
    seg(0, 3000, 0, 0),
    // party wall with a door gap 1050–1950
    seg(4000, 0, 4000, 1050),
    seg(4000, 1950, 4000, 3000),
  ];
  return { walls, door: [4000, 1500] };
}

test("a sealed room measures its inner area to within 1 % and reports its perimeter", () => {
  const { walls } = twoRooms();
  const seal = seg(4000, 1050, 4000, 1950);
  const out = fillRooms([...walls, seal], [], [{ name: "LOUNGE", x: 2000, y: 1500, known: true }, { name: "DINING", x: 6000, y: 1500, known: true }], bounds, 1);
  assert.equal(out.rooms.length, 2);
  for (const r of out.rooms) {
    assert.ok(Math.abs(r.areaM2 - 12) / 12 < 0.01, `${r.name} = ${r.areaM2}`);
    assert.ok(Math.abs(r.perimeterM - 14) / 14 < 0.05, `${r.name} perimeter ${r.perimeterM}`);
    assert.equal(r.sealed, "walls");
  }
  assert.deepEqual(out.unmeasured, []);
});

test("an unsealed door gap merges the rooms; the door geometry, else the closing, seals it on the retry", () => {
  const { walls } = twoRooms();
  const seeds = [{ name: "LOUNGE", x: 2000, y: 1500, known: true }, { name: "DINING", x: 6000, y: 1500, known: true }];
  // no door geometry at all: the 900 gap closes morphologically
  const closed = fillRooms(walls, [], seeds, bounds, 1);
  assert.equal(closed.rooms.length, 2);
  assert.ok(closed.rooms.every((r) => r.sealed === "closed" && r.sharedWith.length === 0));
  // a gap too wide to close is one enclosure holding two labels: open plan
  const wide = [...walls.slice(0, 4), seg(4000, 0, 4000, 500), seg(4000, 2500, 4000, 3000)];
  const merged = fillRooms(wide, [], seeds, bounds, 1);
  assert.equal(merged.rooms.length, 1, "one fill takes both rooms");
  assert.ok(Math.abs(merged.rooms[0]!.areaM2 - 24) / 24 < 0.02);
  assert.deepEqual(merged.rooms[0]!.sharedWith, ["DINING"]);
  assert.deepEqual(merged.unmeasured.map((u) => u.why), ["already filled"]);
  const leaf = seg(4000, 1050, 4900, 1050);
  const swing = Array.from({ length: 8 }, (_, k) => {
    const a0 = (Math.PI / 2) * (k / 8);
    const a1 = (Math.PI / 2) * ((k + 1) / 8);
    return seg(4000 + 900 * Math.cos(a0), 1050 + 900 * Math.sin(a0), 4000 + 900 * Math.cos(a1), 1050 + 900 * Math.sin(a1));
  });
  // the leaf and swing close the gap on the second attempt
  const sealed = fillRooms(walls, [leaf, ...swing], seeds, bounds, 1);
  assert.equal(sealed.rooms.length, 2);
  assert.ok(sealed.rooms.every((r) => r.sealed === "openings" && r.sharedWith.length === 0));
});

test("a label outside any enclosure leaks; a label buried in a hatched wall is on a wall", () => {
  const { walls } = twoRooms();
  // a 200 mm band of hatch lines: every cell within reach of the seed is wall
  const hatch = Array.from({ length: 11 }, (_, k) => seg(8000, 4000 + k * 20, 12000, 4000 + k * 20));
  const seeds = [
    { name: "TERRACE", x: 9000, y: 9000, known: true },
    { name: "STORE", x: 10000, y: 4100, known: true },
  ];
  const out = fillRooms([...walls, ...hatch], [], seeds, { minX: -2000, minY: -2000, maxX: 12000, maxY: 12000 }, 1);
  assert.deepEqual(out.rooms, []);
  assert.deepEqual(
    out.unmeasured.sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: "STORE", why: "on a wall" },
      { name: "TERRACE", why: "leaked" },
    ],
  );
});

test("the grid coarsens for a large plan so a tower floor still fits in memory", () => {
  const big = { minX: 0, minY: 0, maxX: 120000, maxY: 120000 };
  const out = fillRooms([seg(0, 0, 120000, 0), seg(120000, 0, 120000, 120000), seg(120000, 120000, 0, 120000), seg(0, 120000, 0, 0)], [], [{ name: "HALL", x: 60000, y: 60000, known: true }], big, 1);
  assert.equal(out.cellMm, 40);
  // the whole floor is one fill: too large to be a room
  assert.deepEqual(out.unmeasured.map((u) => u.why), ["too large"]);
});
