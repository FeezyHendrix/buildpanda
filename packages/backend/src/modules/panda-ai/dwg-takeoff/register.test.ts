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

test("a title block naming a plan is not a plan: a floor plan has walls, and its title loses the DRAWING: prefix", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  // a title block below and to the right of the plan: a frame, a few dividers and its text
  s.rect("0", 30000, -12000, 18000, 5000);
  s.line("0", [30000, -9500], [48000, -9500]);
  s.line("0", [36000, -12000], [36000, -7000]);
  s.text("0", [42300, -8200], "DRAWING: GROUND FLOOR PLAN");
  s.text("0", [42300, -9100], "DRG NO A-101");
  s.text("0", [30300, -8200], "PANDA ARCHITECTS");
  // and a scale bar beside it, enough lines to make the annotations a cluster of their own
  s.line("0", [30000, -14000], [40000, -14000]);
  s.line("0", [30000, -13700], [40000, -13700]);
  for (let m = 0; m <= 10; m++) s.line("0", [30000 + m * 1000, -14000], [30000 + m * 1000, -13700]);
  s.text("0", [30000, -13200], "SCALE BAR 1:100");
  const sheets = register(s);
  const plans = sheets.filter((x) => x.kind === "floor-plan");
  assert.equal(plans.length, 1, sheets.map((x) => `${x.kind}:${x.title}`).join(", "));
  assert.equal(plans[0]!.title, "Ground Floor Plan");
  const block = sheets.find((x) => /title block and notes/i.test(x.title));
  assert.ok(block && block.kind === "unknown", sheets.map((x) => `${x.kind}:${x.title}`).join(", "));
});

test("a schedule sheet is a schedule, and imperial level marks read as millimetres", () => {
  const s = synth();
  s.header({ INSUNITS: 1 });
  const inch = 1 / 25.4;
  // a plan in inches with an imperial level mark
  for (let i = 0; i < 40; i++) s.line("WALL", [i * 300 * inch, 0], [i * 300 * inch, 8000 * inch]);
  for (let i = 0; i < 40; i++) s.line("WALL", [0, i * 200 * inch], [12000 * inch, i * 200 * inch]);
  s.text("TEXT", [2000 * inch, 4000 * inch], "BEDROOM");
  s.text("TEXT", [8000 * inch, 4000 * inch], "LOUNGE");
  s.text("TEXT", [2000 * inch, 5000 * inch], `+1'-5 3/4"`);
  s.text("TEXT", [4000 * inch, -2500 * inch], "GROUND FLOOR PLAN");
  // a door schedule table well away from the plan
  const ox = 60000 * inch;
  for (let r = 0; r < 6; r++) s.line("0", [ox, -r * 700 * inch], [ox + 9000 * inch, -r * 700 * inch]);
  for (let c = 0; c < 5; c++) s.line("0", [ox + c * 2250 * inch, 0], [ox + c * 2250 * inch, -3500 * inch]);
  s.text("TEXT", [ox, 300 * inch], "DOOR SCHEDULE");
  s.text("TEXT", [ox + 200 * inch, -500 * inch], "D01");
  const sheets = register(s);
  const plan = sheets.find((x) => x.kind === "floor-plan")!;
  assert.equal(plan.levelMm, 451);
  assert.ok(sheets.some((x) => x.kind === "schedule" && /schedule/i.test(x.title)), sheets.map((x) => `${x.kind}:${x.title}`).join(", "));
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
