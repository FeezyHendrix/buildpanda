import { test } from "node:test";
import assert from "node:assert/strict";
import { combine, countColumns, countDoors, countSanitary, countWindowsOnPlan, stairs, windowGroupsOnElevation, type SheetContext } from "./elements.ts";
import { buildRegister } from "./register.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { smallBuilding, synth, type Synth } from "./fixtures.ts";
import type { RegisterSheet } from "./types.ts";

function plan(s: Synth, pick: (x: RegisterSheet) => boolean = (x) => x.kind === "floor-plan"): SheetContext {
  const doc = s.doc();
  const units = inferUnits(doc);
  const map = proposeLayerMap(doc, units.scaleToMm).map;
  const sheet = buildRegister(doc, units, map).find(pick)!;
  return { doc, sheet, map, units };
}

const sheet = { id: 1, code: "DWG-01", title: "Plan" } as RegisterSheet;

test("combine: agreement within 10 % is high, one method is medium, disagreement is low with the reason", () => {
  const high = combine("doors", "Doors", "nr", [{ label: "leaves", count: 20, evidence: [1] }, { label: "arcs", count: 19, evidence: [2] }], sheet);
  assert.equal(high?.confidence, "high");
  assert.match(high?.crossCheck ?? "", /arcs 19 · agree/);
  const medium = combine("doors", "Doors", "nr", [{ label: "leaves", count: 20, evidence: [1] }, { label: "arcs", count: 0, evidence: [] }], sheet);
  assert.equal(medium?.confidence, "medium");
  assert.equal(medium?.reason, "single method");
  const low = combine("doors", "Doors", "nr", [{ label: "leaves", count: 20, evidence: [1] }, { label: "arcs", count: 10, evidence: [2] }], sheet);
  assert.equal(low?.confidence, "low");
  assert.match(low?.crossCheck ?? "", /disagree by 50%/);
  assert.equal(combine("doors", "Doors", "nr", [{ label: "leaves", count: 0, evidence: [] }], sheet), null);
});

test("columns: closed outlines 150–900 mm on the column layer, with a block count as the second method", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.rect("COLUMN", 6000, 6000, 2000, 2000); // a slab outline on the wrong layer is not a column
  const columns = countColumns(plan(s));
  assert.equal(columns?.quantity, 4);
  assert.equal(columns?.evidence?.length, 4);
});

test("doors: leaf outlines up to 2.4 m wide (a sliding door) and swing arcs 0.5–1.5 m", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.rect("DOOR", 4000, 7770, 2250, 230); // a sliding door across the north wall
  const doors = countDoors(plan(s));
  assert.equal(doors?.quantity, 4, "three swings plus the sliding door, which has a leaf and no swing");
  assert.equal(doors?.confidence, "medium", "an unpaired leaf leaves nothing to corroborate the count with");
});

test("windows on plan: anything on the window layer within 300 mm is one window", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.line("WIND", 1500 as never, [1500, 100] as never); // malformed entity is ignored
  const windows = countWindowsOnPlan(plan(s));
  assert.equal(windows?.quantity, 6);
});

test("windows on an elevation: frame and pane group as one window with its median area", () => {
  const s = synth();
  smallBuilding(s, { floors: 2 });
  const w = windowGroupsOnElevation(plan(s, (x) => x.kind === "elevation"));
  assert.equal(w.groups.length, 8);
  assert.ok(w.medianAreaM2 !== null && w.medianAreaM2 > 1 && w.medianAreaM2 < 1.6);
});

test("sanitary: blocks plus drawn outlines clear of a block; an outline hugging a block is the block", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const wc = s.block("WCLOSF3T", [{ entity: "LWPOLYLINE", points: [[0, 0], [400, 0], [400, 700], [0, 700]], flag: 512 }]);
  s.insert("SANITARY", wc, [1000, 6000]);
  s.rect("SANITARY", 1000, 6000, 250, 400); // cistern drawn over the WC block
  s.rect("SANITARY", 4000, 6000, 1700, 800); // a bath
  const sanitary = countSanitary(plan(s));
  assert.equal(sanitary?.quantity, 2);
});

test("stairs: the plan's own riser note wins and the step lines cross-check it", () => {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.text("TEXT", [9000, 6000], "19 nos risers of 158mm each");
  for (let i = 0; i < 19; i++) s.line("STEP", [8000 + i * 275, 5000], [8000 + i * 275, 6000]);
  const item = stairs(plan(s), ["20 nos risers of 150mm"]);
  assert.match(item?.description ?? "", /19 risers of 158 mm \(rise 3 m\)/);
  assert.equal(item?.confidence, "high");
  assert.match(item?.crossCheck ?? "", /19 step lines ≈ 1 flight/);
});
