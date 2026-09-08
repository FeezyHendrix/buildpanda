import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { smallBuilding, synth, type Synth } from "./fixtures.ts";

function register(s: Synth) {
  const doc = s.doc();
  const units = inferUnits(doc);
  return buildRegister(doc, units, proposeLayerMap(doc, units.scaleToMm).map);
}

test("labels decide kind: a section marker letter on a plan does not make it a section", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.text("TEXT", [-1500, 4000], "A");
  s.text("TEXT", [13500, 4000], "A");
  const [plan] = register(s);
  assert.equal(plan?.kind, "floor-plan");
  assert.equal(plan?.levelName, "Ground floor");
});

test("a note containing the word plan is not a title; a roof plan is not measured as a floor", () => {
  const s = synth();
  s.header({ INSUNITS: 4 });
  for (let i = 0; i < 30; i++) s.line("ROOF", [i * 400, 0], [i * 400, 8000]);
  s.text("TEXT", [2000, -1500], "ROOF PLAN");
  s.mtext("TEXT", [2000, -3000], "38x300mm hardwood fascia board clad in plan anodised aluminium sheets");
  const [roof] = register(s);
  assert.equal(roof?.title, "Roof Plan");
  assert.equal(roof?.kind, "unknown");
});

test("stacked level marks make an elevation, one repeated mark makes a plan at that level", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const sheets = register(s);
  const elevation = sheets.find((x) => x.kind === "elevation");
  assert.ok(elevation);
  assert.equal(elevation.levelName, null);
  const plans = sheets.filter((x) => x.kind === "floor-plan");
  assert.deepEqual(plans.map((p) => p.levelMm), [450, 3450]);
  // bare numbers are tags, not levels
  assert.ok(plans.every((p) => p.levelMm !== 12));
});

test("the same floor pasted twice at the same level is one floor, not two", () => {
  const s = synth();
  smallBuilding(s, { floors: 2, storeyMm: 0 });
  const plans = register(s).filter((x) => x.kind === "floor-plan");
  assert.equal(plans.length, 2);
  assert.ok(plans.every((p) => p.multiplier === 1 && p.representative));
});

test("every sheet has bounds that hold its geometry and a code in register order", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const sheets = register(s);
  assert.deepEqual(sheets.map((x) => x.code), sheets.map((_, i) => `DWG-${String(i + 1).padStart(2, "0")}`));
  const ground = sheets.find((x) => x.levelMm === 450)!;
  assert.ok(ground.bounds.minX <= 0 && ground.bounds.maxX >= 12000 && ground.bounds.maxY >= 8000);
  assert.ok(ground.widthM >= 12 && ground.widthM < 16);
  assert.ok(ground.labels.includes("GROUND FLOOR PLAN"));
});
