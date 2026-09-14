import { test } from "node:test";
import assert from "node:assert/strict";
import { attributeSizes } from "./attributes.ts";
import { expandInserts } from "./dwg-inserts.ts";
import { measureDoc } from "./engine.ts";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { smallBuilding, synth } from "./fixtures.ts";

test("door widths and window sizes are read from the block attributes on the sheet", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const door = s.block("DOOR", [{ entity: "ARC", center: [0, 0], radius: 1000, start_angle: 0, end_angle: Math.PI / 2 }]);
  const win = s.block("WINDOW", [{ entity: "LWPOLYLINE", points: [[-750, -60], [750, -60], [750, 60], [-750, 60]], flag: 512 }]);
  s.insert("DOOR", door, [3000, 4000], { attributes: { MARK: "D01", WIDTH: "1000" } });
  s.insert("DOOR", door, [9000, 4000], { attributes: { MARK: "D02", WIDTH: "900" } });
  s.insert("WIND", win, [2000, 7770], { attributes: { MARK: "W01", SIZE: "1500x1200" } });
  const doc = expandInserts(s.doc()).doc;
  const units = inferUnits(doc);
  const map = proposeLayerMap(doc, units.scaleToMm).map;
  const [plan] = buildRegister(doc, units, map);
  const sizes = attributeSizes(doc, plan!, map);
  assert.deepEqual(sizes.doorWidthsMm.sort(), [1000, 900].sort());
  assert.deepEqual(sizes.windowAreasM2, [1.8]);
  assert.equal(sizes.tagged, 3);
});

test("stated opening sizes drive the wall deduction and the basis says so", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const win = s.block("WINDOW", [{ entity: "LWPOLYLINE", points: [[-750, -60], [750, -60], [750, 60], [-750, 60]], flag: 512 }]);
  for (const x of [2000, 5000, 8000]) s.insert("WIND", win, [x, 7770], { attributes: { MARK: "W01", SIZE: "1500x1200" } });
  const r = measureDoc(s.doc());
  const wall = r.items.find((i) => i.trade === "walls")!;
  assert.match(wall.basis, /opening sizes from 3 block attributes/);
});
