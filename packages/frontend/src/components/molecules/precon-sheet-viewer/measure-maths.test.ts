import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MeasureTool } from "@/api/precon";
import { PRECON_TOOLS, PRECON_TOOL_META, isTypingTarget, toolForShortcut } from "@/lib/precon-meta";
import { MEASURE_DEFAULT_UNIT, previewQuantity, runningTotal } from "./measure-maths";

// Mirrors MEASURE_TOOLS in api/precon.ts, which cannot be imported at runtime
// here because that module loads the axios client (and Vite's import.meta.env).
const MEASURE_TOOLS: readonly MeasureTool[] = ["length", "polyline", "area", "count", "volume", "wall_area"];

// 1 pt = 100 mm = 0.1 m, so a 100 pt edge is 10 m.
const MM_PER_PT = 100;
const SQUARE = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

describe("tool shortcuts", () => {
  it("maps the brief's keys to their tools", () => {
    const expected: Record<string, string> = {
      v: "select", z: "magnifier", l: "length", p: "linear", a: "area", r: "room_fill", c: "count", b: "volume",
      w: "wall_area", d: "deduct", t: "typical", s: "scale", f: "find_symbol", o: "overlay", g: "legend",
    };
    for (const [key, tool] of Object.entries(expected)) {
      assert.equal(toolForShortcut(key), tool, `key ${key}`);
      assert.equal(toolForShortcut(key.toUpperCase()), tool, `key ${key.toUpperCase()}`);
    }
  });

  it("gives every tool exactly one distinct single-letter key", () => {
    const keys = PRECON_TOOL_META.map((meta) => meta.shortcut);
    assert.equal(new Set(keys).size, PRECON_TOOLS.length);
    assert.ok(keys.every((key) => /^[A-Z]$/.test(key)));
  });

  it("ignores modified keys and non-letters", () => {
    assert.equal(toolForShortcut("l", { ctrl: true }), null);
    assert.equal(toolForShortcut("l", { meta: true }), null);
    assert.equal(toolForShortcut("Enter"), null);
    assert.equal(toolForShortcut("x"), null);
  });

  it("does not fire while typing", () => {
    assert.equal(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget), true);
    assert.equal(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget), true);
    assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget), true);
    assert.equal(isTypingTarget({ tagName: "DIV" } as unknown as EventTarget), false);
    assert.equal(isTypingTarget(null), false);
  });

  it("covers every backend measure tool with a drawing tool", () => {
    const drawn = new Set(PRECON_TOOL_META.flatMap((meta) => (meta.measure ? [meta.measure] : [])));
    for (const tool of MEASURE_TOOLS) assert.ok(drawn.has(tool), tool);
  });
});

describe("previewQuantity", () => {
  it("uses the contract's default units", () => {
    assert.deepEqual(MEASURE_DEFAULT_UNIT, { length: "m", polyline: "m", area: "m2", count: "nr", volume: "m3", wall_area: "m2" });
  });

  it("measures a length and a polyline in metres", () => {
    assert.deepEqual(previewQuantity("length", [[0, 0], [100, 0]], MM_PER_PT), { gross: 10, qty: 10, unit: "m", secondary: null });
    assert.equal(previewQuantity("polyline", [[0, 0], [100, 0], [100, 50]], MM_PER_PT)?.gross, 15);
  });

  it("measures an area by shoelace with the perimeter as a secondary figure", () => {
    const preview = previewQuantity("area", SQUARE, MM_PER_PT);
    assert.equal(preview?.gross, 100);
    assert.equal(preview?.unit, "m2");
    assert.equal(preview?.secondary, "perimeter 40 m");
  });

  it("counts pins", () => {
    assert.equal(previewQuantity("count", [[1, 1], [2, 2], [3, 3]], MM_PER_PT)?.qty, 3);
  });

  it("needs a depth for volume and a height for wall area", () => {
    assert.equal(previewQuantity("volume", SQUARE, MM_PER_PT), null);
    assert.equal(previewQuantity("volume", SQUARE, MM_PER_PT, { depthM: 0.15 })?.gross, 15);
    assert.equal(previewQuantity("wall_area", [[0, 0], [100, 0]], MM_PER_PT), null);
    assert.equal(previewQuantity("wall_area", [[0, 0], [100, 0]], MM_PER_PT, { heightM: 2.7 })?.gross, 27);
  });

  it("multiplies by typical after rounding the gross", () => {
    const preview = previewQuantity("length", [[0, 0], [100, 0]], MM_PER_PT, {}, 4);
    assert.equal(preview?.gross, 10);
    assert.equal(preview?.qty, 40);
  });

  it("returns null for too few points or no scale", () => {
    assert.equal(previewQuantity("area", [[0, 0], [1, 1]], MM_PER_PT), null);
    assert.equal(previewQuantity("length", [[0, 0]], MM_PER_PT), null);
    assert.equal(previewQuantity("length", [[0, 0], [100, 0]], 0), null);
  });
});

describe("runningTotal", () => {
  it("reports the figure so far in the tool's unit", () => {
    assert.equal(runningTotal("length", [[0, 0], [100, 0]], MM_PER_PT), "10 m so far");
    assert.equal(runningTotal("count", [[0, 0]], MM_PER_PT), "1 pin so far");
    assert.equal(runningTotal("area", [[0, 0], [100, 0]], MM_PER_PT), "10 m so far");
    assert.equal(runningTotal("area", SQUARE, MM_PER_PT), "100 m² so far · perimeter 40 m");
    assert.equal(runningTotal("wall_area", [[0, 0], [50, 0]], MM_PER_PT), "5 m so far");
    assert.equal(runningTotal("length", [], MM_PER_PT), null);
  });
});
