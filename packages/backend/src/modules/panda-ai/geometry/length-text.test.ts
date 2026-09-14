import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLengthText, parseLevelMark } from "./length-text.ts";

test("parseLengthText: bare numbers stay in drawing units, feet and inches become millimetres", () => {
  assert.deepEqual(parseLengthText("4500"), { value: 4500, mm: null, imperial: false });
  assert.deepEqual(parseLengthText("4,500"), { value: 4500, mm: null, imperial: false });
  assert.deepEqual(parseLengthText("4.5m"), { value: 4.5, mm: 4500, imperial: false });
  const ft = parseLengthText(`14'-9 1/8"`)!;
  assert.equal(ft.imperial, true);
  // 14 ft 9 1/8 in = 177.125 in
  assert.ok(Math.abs(ft.mm! - 4498.98) < 0.2, `${ft.mm}`);
  assert.ok(Math.abs(parseLengthText(`9'-10"`)!.mm! - 2997.2) < 0.2);
  assert.ok(Math.abs(parseLengthText(`30"`)!.mm! - 762) < 0.01);
  assert.ok(Math.abs(parseLengthText(`12' 6"`)!.mm! - 3810) < 0.01);
  assert.equal(parseLengthText("LOUNGE"), null);
  assert.equal(parseLengthText("W01"), null);
  assert.equal(parseLengthText("0"), null);
});

test("parseLevelMark: signed marks in mm, metres or feet-inches, with the floor name that follows", () => {
  assert.deepEqual(parseLevelMark("+3450 FIRST FLOOR SLAB"), { mm: 3450, rest: "FIRST FLOOR SLAB" });
  assert.deepEqual(parseLevelMark("FFL +6.450"), { mm: 6450, rest: "" });
  assert.deepEqual(parseLevelMark("-1200"), { mm: -1200, rest: "" });
  const imp = parseLevelMark(`+11'-3 7/8" FIRST FLOOR SLAB`)!;
  assert.equal(imp.mm, 3451);
  assert.equal(imp.rest, "FIRST FLOOR SLAB");
  assert.equal(parseLevelMark("4500"), null, "an unsigned number is a dimension, not a level");
  assert.equal(parseLevelMark("D01"), null);
});
