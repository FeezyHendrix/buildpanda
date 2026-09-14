import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegister } from "./register.ts";
import { measureRoof } from "./roof.ts";
import { classifyRoof, pitchFromLabels } from "./roof-shape.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { inferUnits } from "./units.ts";
import { smallBuilding, synth, type Synth } from "./fixtures.ts";

const OX = 60000;
const W = 12600;
const H = 8600;

/** A roof plan beside the building: outline, and whatever meets inside it. */
function roofPlan(kind: "flat" | "gable" | "hipped", label = "ROOF PLAN"): Synth {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  s.rect("ROOF", OX, 0, W, H);
  if (kind === "gable") s.line("ROOF", [OX, H / 2], [OX + W, H / 2]);
  if (kind === "hipped") {
    s.line("ROOF", [OX + H / 2, H / 2], [OX + W - H / 2, H / 2]);
    s.line("ROOF", [OX, 0], [OX + H / 2, H / 2]);
    s.line("ROOF", [OX, H], [OX + H / 2, H / 2]);
    s.line("ROOF", [OX + W, 0], [OX + W - H / 2, H / 2]);
    s.line("ROOF", [OX + W, H], [OX + W - H / 2, H / 2]);
  }
  // a roof plan carries more than its outline: the wall line under the
  // overhang, the gutters and the downpipes, which is what makes it a drawing
  s.rect("ROOF", OX + 300, 300, W - 600, H - 600);
  for (const y of [0, H]) s.line("ROOF", [OX + 600, y], [OX + W - 600, y]);
  for (const x of [OX, OX + W]) s.line("ROOF", [x, 600], [x, H - 600]);
  const downpipes: [number, number][] = [
    [600, 600],
    [W - 600, 600],
    [600, H - 600],
    [W - 600, H - 600],
  ];
  for (const [dx, dy] of downpipes) s.rect("ROOF", OX + dx - 150, dy - 150, 300, 300);
  s.text("TEXT", [OX + 4000, -2500], label);
  s.text("TEXT", [OX + 4000, H + 1200], "ROOF OVER");
  return s;
}

function measure(s: Synth) {
  const doc = s.doc();
  const units = inferUnits(doc);
  const map = proposeLayerMap(doc, units.scaleToMm).map;
  const sheets = buildRegister(doc, units, map);
  const sheet = sheets.find((sh) => sh.kind === "roof-plan");
  assert.ok(sheet, `expected a roof plan, got ${sheets.map((sh) => `${sh.kind}:${sh.title}`).join(", ")}`);
  return { items: measureRoof(doc, sheet, map, units), sheet };
}

test("a flat roof is measured on plan, with the eaves round it", () => {
  const { items, sheet } = measure(roofPlan("flat"));
  assert.match(sheet.title, /roof plan/i);
  const covering = items.find((i) => i.unit === "m2");
  assert.match(covering?.description ?? "", /^Flat roof covering/);
  assert.ok(Math.abs((covering?.quantity ?? 0) - 108.36) < 0.5, `covering ${covering?.quantity}`);
  assert.equal(covering?.shapes?.[0]?.kind, "area");
  const eaves = items.find((i) => i.description.startsWith("Eaves"));
  assert.ok(Math.abs((eaves?.quantity ?? 0) - 42.4) < 0.5, `eaves ${eaves?.quantity}`);
  assert.equal(items.filter((i) => i.description === "Ridge").length, 0);
});

test("a ridge with no hips is a gable roof, and the ridge is its own line", () => {
  const { items } = measure(roofPlan("gable"));
  const covering = items.find((i) => i.unit === "m2");
  assert.match(covering?.description ?? "", /^Gable roof covering/);
  assert.match(covering?.basis ?? "", /no pitch is stated/);
  const ridge = items.find((i) => i.description === "Ridge");
  assert.ok(Math.abs((ridge?.quantity ?? 0) - 12.6) < 0.3, `ridge ${ridge?.quantity}`);
  assert.equal(items.find((i) => i.description === "Hips"), undefined);
});

test("hips out to the corners make it a hipped roof, and each is measured", () => {
  const { items } = measure(roofPlan("hipped"));
  const covering = items.find((i) => i.unit === "m2");
  assert.match(covering?.description ?? "", /^Hipped roof covering/);
  const hips = items.find((i) => i.description === "Hips");
  // four hips of √(4.3² + 4.3²) ≈ 6.08 m
  assert.ok(Math.abs((hips?.quantity ?? 0) - 24.3) < 0.6, `hips ${hips?.quantity}`);
  assert.equal(hips?.shapes?.length, 4, "one mark per hip");
  const ridge = items.find((i) => i.description === "Ridge");
  assert.ok(Math.abs((ridge?.quantity ?? 0) - 4.0) < 0.5, `ridge ${ridge?.quantity}`);
});

test("a stated pitch turns the plan area into the area a roofer covers", () => {
  const { items } = measure(roofPlan("hipped", "ROOF PLAN; PITCH 30°"));
  const covering = items.find((i) => i.unit === "m2");
  // 108.36 / cos 30° = 125.1
  assert.ok(Math.abs((covering?.quantity ?? 0) - 125.1) < 1, `covering ${covering?.quantity}`);
  assert.match(covering?.description ?? "", /at 30°/);
  assert.equal(covering?.confidence, "medium");
});

test("the pitch is read from degrees, from the word pitch, or from a 1:n fall", () => {
  assert.equal(pitchFromLabels(["ROOF PLAN", "25°"]), 25);
  assert.equal(pitchFromLabels(["PITCH 30 DEG"]), 30);
  assert.equal(pitchFromLabels(["FALL 1:3"]), 18.4);
  assert.equal(pitchFromLabels(["ROOF PLAN"]), null);
});

test("classifyRoof names a pyramid from its hips alone", () => {
  const outline = [
    [0, 0],
    [8000, 0],
    [8000, 8000],
    [0, 8000],
  ];
  const apex = [4000, 4000];
  const hips = outline.map((c) => ({ a: c, b: apex, lengthM: 5.66 }));
  const shape = classifyRoof(outline, hips, 1, []);
  assert.equal(shape.type, "hipped");
  assert.match(shape.reason, /pyramid/);
});

/** The same hipped roof drawn the way architects usually draw one: as its four slope panels. */
function roofPanelsPlan(): Synth {
  const s = synth();
  smallBuilding(s, { floors: 1 });
  const rx = OX;
  const ridgeY = H / 2;
  const a = [rx, 0];
  const b = [rx + W, 0];
  const c = [rx + W, H];
  const d = [rx, H];
  const left = [rx + H / 2, ridgeY];
  const right = [rx + W - H / 2, ridgeY];
  s.poly("ROOF", [a, b, right, left], true);
  s.poly("ROOF", [d, c, right, left], true);
  s.poly("ROOF", [a, left, d], true);
  s.poly("ROOF", [b, right, c], true);
  // the gutters and downpipes that make it a drawing rather than four shapes
  for (const y of [0, H]) s.line("ROOF", [rx + 600, y], [rx + W - 600, y]);
  for (const x of [rx, rx + W]) s.line("ROOF", [x, 600], [x, H - 600]);
  for (const [dx, dy] of [
    [600, 600],
    [W - 600, 600],
    [600, H - 600],
    [W - 600, H - 600],
  ] as [number, number][]) {
    s.rect("ROOF", rx + dx - 150, dy - 150, 300, 300);
  }
  s.text("TEXT", [OX + 4000, -2500], "ROOF PLAN");
  s.text("TEXT", [OX + 4000, H + 1200], "ROOF OVER");
  return s;
}

test("a roof drawn as slope panels is read from the edges the panels share", () => {
  const { items } = measure(roofPanelsPlan());
  const covering = items.find((i) => i.unit === "m2");
  assert.match(covering?.description ?? "", /^Hipped roof covering/);
  assert.ok(Math.abs((covering?.quantity ?? 0) - 108.36) < 1.5, `covering ${covering?.quantity}`);
  assert.match(covering?.crossCheck ?? "", /edges the slope panels share/);
  assert.match(covering?.crossCheck ?? "", /1 ridges, 4 hips/);

  const ridge = items.find((i) => i.description === "Ridge");
  assert.ok(ridge, `no ridge in ${items.map((i) => i.description).join(", ")}`);
  // the ridge spans the building less a half-span of hip at each end
  assert.ok(Math.abs(ridge.quantity - (W - H) / 1000) < 0.2, `ridge ${ridge.quantity}`);

  const hips = items.find((i) => i.description === "Hips");
  assert.ok(hips, "no hips");
  const oneHip = Math.hypot(H / 2, H / 2) / 1000;
  assert.ok(Math.abs(hips.quantity - oneHip * 4) < 0.3, `hips ${hips.quantity} vs ${oneHip * 4}`);
  assert.equal(items.find((i) => /between blocks/.test(i.description)), undefined, "a plain hipped roof has no block joins");
});
