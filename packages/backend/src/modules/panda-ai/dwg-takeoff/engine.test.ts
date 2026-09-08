import { test } from "node:test";
import assert from "node:assert/strict";
import { measureDoc } from "./engine.ts";
import { smallBuilding, synth } from "./fixtures.ts";

// End to end on the synthetic building: register, units, multiplication and
// every element line with its method agreement.

test("a two-storey DWG yields two floor plans, an elevation, units from the header and 3 m storeys", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const r = measureDoc(s.doc());
  assert.equal(r.units?.unit, "mm");
  assert.equal(r.units?.scaleToMm, 1);
  assert.equal(r.units?.basis, "header");
  const plans = (r.sheets ?? []).filter((x) => x.kind === "floor-plan");
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map((p) => p.levelMm), [450, 3450]);
  assert.deepEqual(plans.map((p) => p.title), ["Ground Floor Plan", "1st Floor Plan"]);
  assert.equal(plans[0]?.multiplier, 2, "identical floors at distinct levels multiply on the lowest");
  assert.equal(plans[1]?.multiplier, 1);
  assert.equal(plans[1]?.representative, false);
  const elevation = (r.sheets ?? []).find((x) => x.kind === "elevation");
  assert.equal(elevation?.title, "North View");
  assert.equal(elevation?.levelMm, null);
  assert.equal(r.layerMap?.WALL, "walls");
  assert.equal(r.layerMap?.DIM, "dimensions");
  assert.equal(r.layerMap?.level, "levels");
});

test("elements are counted by two methods on the representative floor and multiplied by identical floors", () => {
  const s = synth();
  smallBuilding(s, { floors: 3 });
  const r = measureDoc(s.doc());
  const columns = r.items.find((i) => i.trade === "columns");
  assert.equal(columns?.quantity, 12, "4 columns × 3 floors");
  assert.equal(columns?.multiplier, 3);
  assert.match(columns?.basis ?? "", /× 3 identical floors \(\+450, \+3450, \+6450\)/);
  const doors = r.items.find((i) => i.trade === "doors");
  assert.equal(doors?.quantity, 9);
  assert.equal(doors?.confidence, "high", "leaf outlines and swing arcs agree");
  assert.match(doors?.reason ?? "", /agree/);
  const windows = r.items.find((i) => i.trade === "windows" && i.description.startsWith("Windows, as drawn on plan"));
  assert.equal(windows?.quantity, 18);
  const walls = r.items.filter((i) => i.trade === "walls");
  assert.ok(walls.length >= 1);
  assert.match(walls[0]?.description ?? "", /225mm thick/);
  assert.match(walls[0]?.basis ?? "", /× 3 m \(floor-to-floor from level marks \+450, \+3450, \+6450\)/);
  assert.ok(walls.every((w) => (w.evidence?.length ?? 0) > 0), "every wall line cites the handles it came from");
  const rooms = r.items.filter((i) => i.trade === "floor areas");
  assert.deepEqual(rooms.map((x) => x.description.split(" — ")[0]).sort(), ["BEDROOM", "LOUNGE"]);
  for (const room of rooms) assert.ok(room.quantity > 30 && room.quantity < 150, `${room.description} = ${room.quantity}`);
  assert.ok(r.items.every((i) => i.basis.length > 0 && i.sheetId !== undefined), "every line names its sheet and basis");
});

test("paper space and block definitions are never measured", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  // a paper-space title block full of columns, and a block that holds a column
  for (let i = 0; i < 40; i++) s.line("COLUMN", [i * 500, -50000], [i * 500 + 300, -50000], { paper: true });
  s.block("COLBLOCK", [{ entity: "LWPOLYLINE", points: [[0, 0], [300, 0], [300, 300], [0, 300]], flag: 512 }]);
  const r = measureDoc(s.doc());
  const columns = r.items.find((i) => i.trade === "columns");
  assert.equal(columns?.quantity, 4);
});

test("inserts count where they stand: a sanitary block on the plan is a fitting, and its geometry clusters with the drawing", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const wc = s.block("WCLOSF3T", [{ entity: "LWPOLYLINE", points: [[0, 0], [400, 0], [400, 700], [0, 700]], flag: 512 }]);
  s.insert("SANITARY", wc, [1000, 6000]);
  s.insert("SANITARY", wc, [2000, 6000]);
  // a basin drawn by hand, clear of the blocks
  s.rect("SANITARY", 4000, 6000, 600, 450);
  const r = measureDoc(s.doc());
  const sanitary = r.items.find((i) => i.trade === "sanitary");
  assert.equal(sanitary?.quantity, 3);
  assert.equal(sanitary?.confidence, "high");
  assert.match(sanitary?.basis ?? "", /WCLOSF3T ×2/);
});

test("a stated area per flat is reconciled against the room sum, and a reviewer's layer map is honoured", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.text("TEXT", [4000, -4000], "each flat occupies 80 square metres only.");
  s.text("TEXT", [8000, 5000], "KITCHEN");
  const base = measureDoc(s.doc());
  assert.ok(base.notes.some((n) => /sheet states 80 m² per flat/.test(n)), base.notes.join("\n"));
  // the reviewer says the COLUMN layer is furniture: no columns are counted
  const remapped = measureDoc(s.doc(), { layerMap: { ...base.layerMap, COLUMN: "furniture" } });
  assert.equal(remapped.items.find((i) => i.trade === "columns"), undefined);
  assert.equal(remapped.layerMap?.COLUMN, "furniture");
});

test("a drawing with no floor plan measures nothing and says so", () => {
  const s = synth();
  s.header({ INSUNITS: 4 });
  for (let i = 0; i < 30; i++) s.line("WALL", [i * 300, 0], [i * 300, 5000]);
  s.text("TEXT", [3000, -1500], "SECTION A-A");
  const r = measureDoc(s.doc());
  assert.equal(r.items.length, 0);
  assert.ok(r.notes.some((n) => /No floor plan found/.test(n)));
});
