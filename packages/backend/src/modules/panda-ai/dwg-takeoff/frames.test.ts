import { test } from "node:test";
import assert from "node:assert/strict";
import { frameHandles } from "./frames.ts";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { smallBuilding, synth } from "./fixtures.ts";

// a sheet border: four lines meeting at their corners, well outside the plan
function border(s: ReturnType<typeof synth>, x: number, y: number, w: number, h: number): number[] {
  return [s.line("0", [x, y], [x + w, y]), s.line("0", [x + w, y], [x + w, y + h]), s.line("0", [x + w, y + h], [x, y + h]), s.line("0", [x, y + h], [x, y])];
}

test("a rectangle of four lines around a drawing is a border; an empty rectangle is not", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const around = border(s, -5000, -8000, 40000, 25000);
  const empty = border(s, 60000, 0, 20000, 12000);
  const frames = frameHandles(s.doc(), 1);
  for (const h of around) assert.ok(frames.has(h), "border line found");
  for (const h of empty) assert.ok(!frames.has(h), "an empty rectangle (a tank, a slab) is not a border");
  const wall = s.doc().entities.find((e) => e.entity === "LINE" && s.doc().layerName(e) === "WALL")!;
  assert.ok(!frames.has(wall.handle![2]!));
});

test("borders on layer 0 do not glue neighbouring drawings together or become drawings of their own", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  border(s, -5000, -8000, 22000, 25000);
  border(s, 17500, -8000, 22000, 25000);
  const doc = s.doc();
  const units = inferUnits(doc);
  const sheets = buildRegister(doc, units, proposeLayerMap(doc, units.scaleToMm).map);
  const plans = sheets.filter((x) => x.kind === "floor-plan");
  assert.equal(plans.length, 2, sheets.map((x) => `${x.kind}:${x.title}`).join(", "));
  assert.ok(plans.every((p) => p.widthM < 16), "a plan's bounds stop at its own geometry, not at the border");
});
