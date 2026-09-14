import { test } from "node:test";
import assert from "node:assert/strict";
import { isDoorSwing, isFitting, isNotWallGeometry, isSquareColumn, isWindowFrame } from "./shapes.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { synth } from "./fixtures.ts";

test("shapes are told apart by size and proportion, whatever layer they sit on", () => {
  const s = synth();
  s.rect("0", 0, 0, 230, 230); // column
  s.rect("0", 1000, 0, 1200, 120); // window frame
  s.rect("0", 3000, 0, 400, 600); // WC
  s.rect("0", 5000, 0, 3000, 230); // a wall outline, not compact
  s.arc("0", [8000, 0], 900, 0, Math.PI / 2); // door swing
  s.arc("0", [9000, 0], 900, 0, Math.PI); // a half circle is not a swing
  s.circle("0", [10000, 0], 200); // basin
  const [column, frame, wc, wall, swing, half, basin] = s.doc().entities.filter((e) => e.entity);
  assert.equal(isSquareColumn(column!, 1), true);
  assert.equal(isSquareColumn(wc!, 1), false, "an oblong is not a column");
  assert.equal(isWindowFrame(frame!, 1), true);
  assert.equal(isWindowFrame(wall!, 1), false);
  assert.equal(isFitting(wc!, 1), true);
  assert.equal(isFitting(basin!, 1), true);
  assert.equal(isFitting(column!, 1), false);
  assert.equal(isDoorSwing(swing!, 1), true);
  assert.equal(isDoorSwing(half!, 1), false);
  assert.equal(isNotWallGeometry(wall!, 1), false, "a long outline can be a wall");
  assert.ok([column, frame, wc, swing, basin].every((e) => isNotWallGeometry(e!, 1)));
});

test("a layer whose name says nothing is classified by what it holds; a mixed layer stays auto", () => {
  const s = synth();
  for (let i = 0; i < 6; i++) s.rect("S-COLS", i * 4000, 0, 230, 230);
  s.rect("P-FIXT", 0, 2000, 400, 600);
  s.rect("P-FIXT", 3000, 2000, 400, 600);
  for (let i = 0; i < 4; i++) s.rect("A-GLZ", i * 4000, 5000, 1200, 120);
  for (let i = 0; i < 3; i++) {
    s.arc("A-DR", [i * 4000, 8000], 900, 0, Math.PI / 2);
    s.line("A-DR", [i * 4000, 8000], [i * 4000, 8900]);
  }
  for (let i = 0; i < 50; i++) s.line("L1", [0, 10000 + i * 300], [12000, 10000 + i * 300]);
  for (let i = 0; i < 5; i++) s.text("T9", [i * 1000, 20000], "BEDROOM");
  // everything at once on "0": no single kind dominates
  s.rect("0", 0, 30000, 230, 230);
  s.arc("0", [5000, 30000], 900, 0, Math.PI / 2);
  s.line("0", [0, 31000], [12000, 31000]);
  s.text("0", [0, 32000], "LOUNGE");
  const { map, profiles } = proposeLayerMap(s.doc(), 1);
  assert.equal(map["S-COLS"], "columns");
  assert.equal(map["P-FIXT"], "sanitary");
  assert.equal(map["A-GLZ"], "windows");
  assert.equal(map["A-DR"], "doors");
  assert.equal(map["L1"], "walls");
  assert.equal(map["T9"], "text");
  assert.equal(map["0"], "auto");
  assert.match(profiles.find((p) => p.name === "P-FIXT")!.note, /2 compact oblong outlines/);
});
