import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { CONVENTIONS, buildDrawing } from "./conventions.ts";
import { generateFixture, hasDwgwrite } from "./generate.ts";
import { runBenchmark } from "./run.ts";

// Baseline recording only: the harness must run end to end on a small subset
// and produce a scored result; nothing here asserts on accuracy, because the
// numbers are the finding, not the gate.

const conv = (id: string) => CONVENTIONS.find((c) => c.id === id)!;

test("truth manifest is internally consistent for every family", () => {
  for (const family of ["bungalow", "duplex", "block4", "tower20"] as const) {
    const { drawing, truth } = buildDrawing(family, conv("named-mm-outlines-dims"));
    assert.equal(truth.sheets.length, drawing.sheets.length);
    const plans = truth.sheets.filter((s) => s.kind === "floor-plan");
    assert.ok(plans.length >= 1);
    for (const plan of plans) {
      const els = truth.elements.filter((e) => e.sheet === plan.id);
      const doors = els.find((e) => e.element === "doors");
      const floor = els.find((e) => e.element === "floor-area");
      assert.ok(doors && (doors.count ?? 0) > 0, `${family}/${plan.id} has doors`);
      assert.ok(floor && (floor.areaM2 ?? 0) > 0, `${family}/${plan.id} has floor area`);
      assert.equal(doors!.ids.length, doors!.count, "every counted door has an entity id");
      const rooms = truth.rooms.filter((r) => r.sheet === plan.id);
      const roomArea = rooms.reduce((a, r) => a + r.areaM2, 0);
      assert.ok(Math.abs(roomArea - floor!.areaM2!) < 0.05, "floor area is the sum of the rooms");
    }
  }
  const block = buildDrawing("block4", conv("named-mm-outlines-dims")).truth;
  assert.equal(block.elements.find((e) => e.element === "columns")?.count, 28, "block4 mirrors the Ogudu column count");
  assert.equal(block.elements.find((e) => e.element === "doors")?.count, 22, "block4 mirrors the Ogudu door count");
  assert.equal(block.storeys, 4);
  assert.equal(buildDrawing("tower20", conv("named-mm-outlines-dims")).truth.storeys, 20);
});

test("generator writes DXF, LibreDWG JSON, truth and PDF for one fixture", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bp-benchmark-"));
  try {
    const result = await generateFixture("bungalow", conv("named-mm-blocks-dims"), { root, binaries: true });
    const dxf = await fs.readFile(result.fixture.dxf, "utf8");
    assert.match(dxf, /AC1015/);
    assert.match(dxf, /DOOR-900/);
    const json = JSON.parse(await fs.readFile(result.fixture.json, "utf8")) as { OBJECTS: Array<{ entity?: string; object?: string }> };
    assert.ok(json.OBJECTS.some((o) => o.entity === "INSERT"));
    assert.ok(json.OBJECTS.some((o) => o.object === "LAYER"));
    const pdf = await fs.readFile(result.fixture.pdf);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    if (await hasDwgwrite()) {
      assert.equal(result.dwgWritten, true, result.dwgError ?? "");
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("harness scores a small subset and records the baseline", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bp-benchmark-"));
  try {
    const results = await runBenchmark({
      root: path.join(root, "fixtures"),
      families: ["bungalow", "block4"],
      conventions: [conv("named-mm-outlines-dims"), conv("layer0-mm-outlines-dims")],
      regenerate: true,
      oguduPath: null,
    });
    assert.equal(results.fixtures.length, 4);
    for (const f of results.fixtures) {
      assert.equal(f.pdf.ran, true, f.pdf.error ?? "");
      assert.ok(f.pdf.scored.length > 0);
      if (await hasDwgwrite()) {
        assert.equal(f.dwg.ran, true, f.dwg.error ?? "");
        assert.ok(f.dwg.scored.length > 0);
      }
    }
    assert.ok(results.totals.pdf.lines > 0);
    const md = await fs.readFile(path.join(root, "results.md"), "utf8");
    assert.match(md, /# Take-off benchmark/);
    // eslint-disable-next-line no-console
    console.log(`baseline: dwg ${results.totals.dwg.withinShare}% within, pdf ${results.totals.pdf.withinShare}% within`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
