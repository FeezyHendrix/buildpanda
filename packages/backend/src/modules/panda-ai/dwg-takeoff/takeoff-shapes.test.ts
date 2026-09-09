import { test } from "node:test";
import assert from "node:assert/strict";
import { measureDoc } from "./engine.ts";
import { countColumns, countDoors, type SheetContext } from "./elements.ts";
import { fillRooms } from "./room-fill.ts";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { measureWallRuns, wallItems, type WallSegment } from "./walls.ts";
import { polygonArea } from "../pdf-takeoff/room-at.ts";
import { smallBuilding, synth, type Synth } from "./fixtures.ts";
import type { MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// A DWG take-off must annotate the sheet the way a PDF take-off and a
// hand-drawn line do: every measured line carries the shape it was taken
// from, in the drawing's own coordinates.

const seg = (x1: number, y1: number, x2: number, y2: number): WallSegment => ({ handle: 1, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) });
const units: UnitsDecision = { unit: "mm", scaleToMm: 1, basis: "header", errorPct: 0.02, samples: 0, note: "" };
const sheet = { id: 1, code: "DWG-01", title: "Plan", kind: "floor-plan", levelMm: 450 } as RegisterSheet;
const height = { mm: 3000, basis: "level marks", assumed: false };
const noOpenings = { doors: 0, doorWidthMm: null, windows: 0, windowAreaM2: null };

function plan(s: Synth, pick: (x: RegisterSheet) => boolean = (x) => x.kind === "floor-plan"): SheetContext {
  const doc = s.doc();
  const u = inferUnits(doc);
  const map = proposeLayerMap(doc, u.scaleToMm).map;
  return { doc, sheet: buildRegister(doc, u, map).find(pick)!, map, units: u };
}

test("a wall line carries one centreline per paired run, drawn between its two faces", () => {
  // a 10 m run of 225 wall and a 8 m run of 150, both drawn as face pairs
  const m = measureWallRuns([seg(0, 0, 10000, 0), seg(0, 230, 10000, 230), seg(0, 3000, 8000, 3000), seg(0, 3150, 8000, 3150)], 1);
  const items = wallItems(m, height, noOpenings, sheet, units);
  assert.equal(items.length, 2);
  const thick = items[0]!;
  assert.equal(thick.shapes?.length, 1, "one run of 225 wall, one shape");
  const [start, end] = thick.shapes![0]!.vertices;
  assert.equal(thick.shapes![0]!.kind, "linear");
  assert.equal(thick.shapes![0]!.vertices.length, 2, "a run is drawn as its two ends");
  // the centreline sits between the faces (y = 0 and y = 230) and spans the run
  for (const p of [start!, end!]) assert.ok(p[1]! > 0 && p[1]! < 230, `centreline y ${p[1]} is not between the faces`);
  assert.ok(Math.abs(start![1]! - 115) < 1 && Math.abs(end![1]! - 115) < 1);
  assert.ok(Math.abs(Math.abs(end![0]! - start![0]!) - 10000) < 1, "the shape spans the 10 m run");
  const thin = items[1]!;
  assert.equal(thin.shapes?.length, 1);
  for (const p of thin.shapes![0]!.vertices) assert.ok(p[1]! > 3000 && p[1]! < 3150, `centreline y ${p[1]} is not between the 150 faces`);
});

test("a thickness folded into its neighbour keeps its own run on the drawing", () => {
  // 10 m at 225, 8 m at 150 and a 0.6 m sliver at 300: the sliver is pairing
  // noise and folds into the 225 line, but it is still a run on the drawing
  const m = measureWallRuns(
    [
      seg(0, 0, 10000, 0),
      seg(0, 230, 10000, 230),
      seg(0, 3000, 8000, 3000),
      seg(0, 3150, 8000, 3150),
      seg(20000, 0, 20600, 0),
      seg(20000, 300, 20600, 300),
    ],
    1,
  );
  const items = wallItems(m, height, noOpenings, sheet, units);
  assert.deepEqual(items.map((i) => i.quantity), [31.8, 24], "the sliver is priced with the 225 wall");
  assert.equal(items[0]?.shapes?.length, 2, "both the 225 run and the folded 300 sliver are drawn");
  assert.equal(items[1]?.shapes?.length, 1);
  const sliver = items[0]!.shapes!.find((sh) => sh.vertices[0]![0]! > 15000);
  assert.ok(sliver, "the sliver's own run is drawn where it stands");
  for (const p of sliver!.vertices) assert.ok(p[1]! > 0 && p[1]! < 300, `sliver centreline y ${p[1]}`);
});

test("a filled room is traced back into a polygon whose area matches the figure measured", () => {
  const walls = [
    seg(0, 0, 8000, 0),
    seg(8000, 0, 8000, 3000),
    seg(8000, 3000, 0, 3000),
    seg(0, 3000, 0, 0),
    seg(4000, 0, 4000, 3000),
  ];
  const out = fillRooms(walls, [], [{ name: "LOUNGE", x: 2000, y: 1500, known: true }, { name: "DINING", x: 6000, y: 1500, known: true }], { minX: -500, minY: -500, maxX: 8500, maxY: 3500 }, 1);
  assert.equal(out.rooms.length, 2);
  for (const room of out.rooms) {
    assert.ok(room.vertices.length >= 4, `${room.name} traced ${room.vertices.length} vertices`);
    // drawing units are millimetres here, so the polygon is scaled to m²
    const polygonM2 = polygonArea(room.vertices) / 1e6;
    assert.ok(Math.abs(polygonM2 - room.areaM2) / room.areaM2 < 0.02, `${room.name}: polygon ${polygonM2.toFixed(2)} m² vs measured ${room.areaM2} m²`);
  }
});

test("a room line on a plan carries its outline as an area shape in drawing units", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const result = measureDoc(s.doc());
  const rooms = result.items.filter((i) => i.trade === "floor areas");
  assert.ok(rooms.length >= 2, `${rooms.length} rooms measured`);
  for (const room of rooms) {
    assert.equal(room.shapes?.length, 1);
    assert.equal(room.shapes![0]!.kind, "area");
    const polygonM2 = polygonArea(room.shapes![0]!.vertices) / 1e6;
    assert.ok(Math.abs(polygonM2 - room.quantity) / room.quantity < 0.02, `${room.description}: ${polygonM2.toFixed(2)} vs ${room.quantity}`);
    // the outline sits inside the 12 × 8 m plan, in drawing units
    for (const [x, y] of room.shapes![0]!.vertices) assert.ok(x! >= -500 && x! <= 12500 && y! >= -500 && y! <= 8500, `vertex ${x},${y} is off the plan`);
  }
});

test("a count marks every entity it counted, one vertex each, where they stand", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const ctx = plan(s);
  const columns = countColumns(ctx);
  assert.equal(columns?.quantity, 4);
  assert.equal(columns?.shapes?.length, 1);
  assert.equal(columns?.shapes?.[0]?.kind, "count");
  assert.equal(columns?.shapes?.[0]?.vertices.length, columns?.evidence?.length, "one vertex per cited entity");
  // the four columns stand at the plan's corners, in drawing units
  const xs = columns!.shapes![0]!.vertices.map((v) => v[0]!).sort((a, b) => a - b);
  assert.ok(xs[0]! < 500 && xs[3]! > 11000, `columns at ${xs.join(", ")}`);
  const doors = countDoors(ctx);
  // a door is drawn as a swing and a leaf: one mark per door, evidence citing both
  assert.equal(doors?.shapes?.[0]?.vertices.length, doors?.quantity, "one mark per door");
  assert.ok((doors?.evidence?.length ?? 0) >= (doors?.quantity ?? 0), "every entity the count read from is cited");
});

test("an elevation's window note is evidence for another line and marks nothing of its own", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const result = measureDoc(s.doc());
  const notes = result.items.filter((i) => i.noteOnly);
  assert.ok(notes.length >= 1, "the elevation contributes a note-only window count");
  for (const note of notes) assert.equal(note.shapes, undefined, `${note.description} should not be drawn`);
});

test("a whole run annotates walls, rooms and counts, and multiplied floors keep the one sheet's shapes", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const result = measureDoc(s.doc());
  const drawn = result.items.filter((i) => (i.shapes?.length ?? 0) > 0);
  assert.ok(drawn.length >= 6, `${drawn.length} of ${result.items.length} lines are drawn`);
  const kinds = new Set(drawn.flatMap((i) => i.shapes!.map((sh) => sh.kind)));
  assert.deepEqual([...kinds].sort(), ["area", "count", "linear"]);
  // every shape belongs to the sheet the line was measured on
  const bySheet = new Map(result.sheets!.map((x) => [x.id, x]));
  for (const item of drawn) {
    const sh = bySheet.get(item.sheetId!)!;
    for (const shape of item.shapes!) {
      for (const [x, y] of shape.vertices) {
        assert.ok(x! >= sh.bounds.minX - 1000 && x! <= sh.bounds.maxX + 1000, `${item.description}: x ${x} is off ${sh.code}`);
        assert.ok(y! >= sh.bounds.minY - 1000 && y! <= sh.bounds.maxY + 1000, `${item.description}: y ${y} is off ${sh.code}`);
      }
    }
  }
  // the typical multiplier states the other floors; the shapes stay on the measured one
  const multiplied = result.items.filter((i: MeasuredItem) => (i.multiplier ?? 1) > 1 && i.shapes?.length);
  assert.ok(multiplied.length >= 1);
  assert.ok(multiplied.every((i) => i.sheetId === result.selectedDrawingId), "shapes stay on the representative sheet");
});
