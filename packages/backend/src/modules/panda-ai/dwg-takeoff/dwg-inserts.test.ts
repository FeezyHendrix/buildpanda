import { test } from "node:test";
import assert from "node:assert/strict";
import { expandInserts, realHandles, VIRTUAL_HANDLE_BASE } from "./dwg-inserts.ts";
import { handleOf, isModelSpace } from "./dwg.ts";
import { measureDoc } from "./engine.ts";
import { smallBuilding, synth } from "./fixtures.ts";

test("a block reference is expanded into placed, scaled and rotated model-space entities that cite the insert", () => {
  const s = synth();
  const b = s.block("SYM", [
    { entity: "LINE", start: [0, 0], end: [1000, 0], layerName: "WALL" },
    { entity: "ARC", center: [0, 0], radius: 900, start_angle: 0, end_angle: Math.PI / 2 },
  ]);
  const ins = s.insert("DOOR", b, [5000, 2000], { scale: [2, 2, 1], rotation: Math.PI / 2 });
  const { doc, origin, expanded, inserts } = expandInserts(s.doc());
  assert.equal(inserts, 1);
  assert.equal(expanded, 2);
  const placed = doc.entities.filter((e) => e.insertHandle === ins);
  assert.equal(placed.length, 2);
  const line = placed.find((e) => e.entity === "LINE")!;
  // (1000, 0) scaled by 2 and turned a quarter turn lands at (5000, 4000)
  assert.deepEqual(line.end!.map(Math.round), [5000, 4000]);
  assert.equal(doc.layerName(line), "WALL", "a member on its own layer keeps it");
  const arc = placed.find((e) => e.entity === "ARC")!;
  assert.equal(doc.layerName(arc), "DOOR", "a member on layer 0 takes the insert's layer");
  assert.equal(arc.radius, 1800);
  assert.ok(placed.every((e) => isModelSpace(doc, e) && handleOf(e)! >= VIRTUAL_HANDLE_BASE));
  assert.deepEqual(realHandles(placed.map((e) => handleOf(e)!), origin), [ins], "evidence resolves to the real object");
});

test("a negative x scale mirrors the geometry and reflects the arc's sweep", () => {
  const s = synth();
  const b = s.block("HALF", [
    { entity: "LINE", start: [0, 0], end: [3000, 1000] },
    { entity: "ARC", center: [1000, 0], radius: 900, start_angle: 0, end_angle: Math.PI / 2 },
  ]);
  s.insert("0", b, [10000, 0], { scale: [-1, 1, 1] });
  const { doc } = expandInserts(s.doc());
  const line = doc.entities.find((e) => e.entity === "LINE" && e.insertHandle !== undefined)!;
  assert.deepEqual(line.end, [7000, 1000]);
  const arc = doc.entities.find((e) => e.entity === "ARC" && e.insertHandle !== undefined)!;
  assert.deepEqual(arc.center, [9000, 0]);
  // 0..90° reflected about the y axis is 90..180°: the swing still opens away from the mirrored hinge
  assert.ok(Math.abs(arc.start_angle! - Math.PI / 2) < 1e-9 && Math.abs(arc.end_angle! - Math.PI) < 1e-9);
});

test("a whole floor drawn as one flat inserted twice, the second mirrored, measures like a floor drawn in place", () => {
  const drawn = synth();
  smallBuilding(drawn, { floors: 1 });
  const inPlace = measureDoc(drawn.doc());
  const walls = (r: ReturnType<typeof measureDoc>) => r.items.filter((i) => i.trade === "walls").reduce((a, i) => a + i.quantity, 0);
  assert.ok(walls(inPlace) > 0);

  // the same building as a block, inserted mirrored so it reads right to left
  const s = synth();
  s.header({ INSUNITS: 4 });
  const members: Array<Parameters<typeof s.block>[1][number]> = [];
  const probe = synth();
  smallBuilding(probe, { floors: 1 });
  for (const e of probe.doc().entities) {
    if (!e.entity || e.entmode !== 2 || e.entity === "TEXT" || e.entity.startsWith("DIMENSION")) continue;
    const { handle: _h, layer: _l, ownerhandle: _o, entmode: _m, ...rest } = e;
    members.push({ ...rest, layerName: probe.doc().layerName(e) });
  }
  const b = s.block("FLAT", members);
  s.insert("0", b, [12000, 0], { scale: [-1, 1, 1] });
  for (const e of probe.doc().entities) if (e.entity === "TEXT") s.text(probe.doc().layerName(e), [12000 - e.ins_pt![0]!, e.ins_pt![1]!], e.text_value!);
  for (let d = 0; d < 20; d++) s.dim("DIM", 900 + d * 100);
  const mirrored = measureDoc(s.doc());
  assert.ok(mirrored.notes.some((n) => /1 block references expanded/.test(n)), mirrored.notes.join("\n"));
  assert.ok(Math.abs(walls(mirrored) - walls(inPlace)) / walls(inPlace) < 0.01, `${walls(mirrored)} vs ${walls(inPlace)}`);
  assert.equal(mirrored.items.find((i) => i.trade === "doors")?.quantity, inPlace.items.find((i) => i.trade === "doors")?.quantity);
  assert.equal(mirrored.items.find((i) => i.trade === "columns")?.quantity, inPlace.items.find((i) => i.trade === "columns")?.quantity);
});
