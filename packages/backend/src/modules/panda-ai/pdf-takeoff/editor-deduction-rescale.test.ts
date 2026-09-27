// Openings when the drawing under them is re-scaled.
//
// A cutout is the half of a re-scale that is easiest to get silently wrong. It
// has no scale binding of its own — it belongs to the shape it is cut out of —
// so the only correct scale for it is whatever its PARENT was measured at. Four
// distinct rules, and every one of them is a wrong bill if it is missed:
//
//   * a drawn area cutout scales with the square of mm-per-point, like the slab
//     it comes out of;
//   * a drawn run scales linearly;
//   * a drawn volume cutout scales as an area and keeps the parent's stated
//     depth — re-measuring it without that depth does not produce a small error,
//     it refuses or produces m² subtracted from m³;
//   * a STATED opening (a 0.9 × 2.1 m door) is a real-world size and must not
//     move at all. Scaling it is how a door becomes 3.6 m wide.
//
// And because a line can be measured by several shapes bound to different
// scales, "the sheet's new scale" is not an answer: each cutout has to follow
// its own parent.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { cutoutRig, rect } from "./editor-cutout-fixtures.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import type { SheetViewportInput } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const { apply, preview, undo, rowOf, cutOf, geometryQty, sheetVersion, sheet, create, cut } = cutoutRig(
  () => db,
  () => fixture,
);

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "cutouts");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

describe("a re-calibrated sheet re-cuts the openings on it", () => {
  test("a drawn area cutout scales with the square, a stated door does not move at all", async () => {
    const plan = await sheet("cut_area", 20);
    const slab = await create(plan, "area", rect(0, 0, 6, 4));
    const rowId = slab.rows[0]!.id;
    assert.equal((await rowOf(rowId)).gross, 24, "6 x 4 m");

    const drawn = await cut(rowId, "Void", { vertices: rect(1, 1, 2, 1), sheetId: plan });
    const drawnId = drawn.geometries.find((g) => g.rowId === rowId && g.id !== slab.geometries[0]!.id)?.id ?? "";
    const stated = await cut(rowId, "Door", { mode: "wall-opening", dimensions: { widthM: 0.9, heightM: 2.1 } });
    const statedId = stated.geometries.find((g) => g.id !== drawnId && g.id !== slab.geometries[0]!.id)?.id ?? "";
    assert.ok(drawnId && statedId, "both openings exist");
    assert.equal((await cutOf(rowId, drawnId))?.qty, 2, "the drawn void is 2 x 1 m");
    assert.equal((await cutOf(rowId, statedId))?.qty, 1.89, "the door is 0.9 x 2.1 m");
    assert.equal((await rowOf(rowId)).qty, 24 - 2 - 1.89);

    const shown = await preview().calibration(fixture.sessionId, plan, { newScaleMmPerPt: 100 });
    const line = shown.affectedRows.find((r) => r.rowId === rowId);
    assert.ok(line);
    assert.equal(line.newQtyGross, 96, "the slab quadruples");
    assert.equal(
      line.newQty,
      96 - 8 - 1.89,
      "and the preview NETS the re-cut openings: the drawn void quadruples to 8, the stated door does not move",
    );

    const receipt = await apply({
      kind: "apply-calibration",
      sheetId: plan,
      mmPerPt: 100,
      previewToken: shown.previewToken,
    });
    const applied = await rowOf(rowId);
    assert.equal(applied.gross, 96);
    assert.equal(applied.qty, line.newQty, "the apply writes exactly the net the preview showed");
    assert.equal((await cutOf(rowId, drawnId))?.qty, 8, "the drawn void scaled with the square");
    assert.equal((await cutOf(rowId, statedId))?.qty, 1.89, "the stated door is a real size and did not move");
    assert.equal((await cutOf(rowId, drawnId))?.label, "Void", "labels survive");
    assert.equal((await cutOf(rowId, drawnId))?.unit, "m2", "and so do units");
    assert.equal(await geometryQty(drawnId), 8, "the opening's own stored figure moved with it");

    await undo(receipt.eventId);
    const back = await rowOf(rowId);
    assert.equal(back.gross, 24);
    assert.equal(back.qty, 24 - 2 - 1.89, "undo restores the openings too");
    assert.equal((await cutOf(rowId, drawnId))?.qty, 2);
  });

  test("a drawn run scales linearly and a volume cutout keeps the parent's depth", async () => {
    const plan = await sheet("cut_lin", 21);
    const run = await create(plan, "polyline", [[m(0), m(20)], [m(8), m(20)]]);
    const runRow = run.rows[0]!.id;
    const runCut = await cut(runRow, "Gap", { vertices: [[m(1), m(20)], [m(3), m(20)]], sheetId: plan });
    const runCutId = runCut.geometries.find((g) => g.id !== run.geometries[0]!.id)?.id ?? "";
    assert.equal((await cutOf(runRow, runCutId))?.qty, 2, "a 2 m gap in an 8 m run");

    const slab = await create(plan, "volume", rect(0, 40, 6, 4), { factor: { depthM: 0.15 } });
    const volRow = slab.rows[0]!.id;
    assert.equal((await rowOf(volRow)).gross, 3.6, "24 m2 x 0.15 m");
    const volCut = await cut(volRow, "Pit", { vertices: rect(1, 41, 2, 1), sheetId: plan });
    const volCutId = volCut.geometries.find((g) => g.id !== slab.geometries[0]!.id)?.id ?? "";
    assert.equal((await cutOf(volRow, volCutId))?.qty, 0.3, "2 m2 x the parent's 0.15 m depth");

    const shown = await preview().calibration(fixture.sessionId, plan, { newScaleMmPerPt: 100 });
    assert.equal(
      shown.affectedRows.find((r) => r.rowId === runRow)?.newQty,
      16 - 4,
      "the run doubles and so does the gap in it",
    );
    assert.equal(
      shown.affectedRows.find((r) => r.rowId === volRow)?.newQty,
      13.2,
      "the volume quadruples and the pit is re-cut at the SAME stated depth, not a scaled one",
    );

    await apply({ kind: "apply-calibration", sheetId: plan, mmPerPt: 100, previewToken: shown.previewToken });
    assert.equal((await cutOf(runRow, runCutId))?.qty, 4, "the gap scaled linearly");
    assert.equal((await cutOf(volRow, volCutId))?.qty, 1.2, "8 m2 x 0.15 m, the depth unchanged");
    assert.equal((await rowOf(volRow)).qty, 13.2);
  });
});

describe("each opening follows its OWN parent's scale, never the sheet's", () => {
  test("a line measured by two shapes at two scales re-cuts each against its own", async () => {
    const plan = await sheet("cut_two", 22, [
      { id: "vp_detail", label: "Detail", rect: [m(100), m(100), m(140), m(140)], scaleMmPerPt: 25 },
    ]);
    // One slab on bare sheet (50 mm/pt), one inside the 1:20 region (25 mm/pt).
    const onSheet = await create(plan, "area", rect(0, 0, 6, 4));
    const rowId = onSheet.rows[0]!.id;
    const sheetParent = onSheet.geometries[0]!.id;
    // Cut it BEFORE the second shape exists: `addDeductionIn` attaches an opening
    // to the row's newest shape, so the region-bound one would otherwise adopt it.
    const sheetCut = await cut(rowId, "Sheet void", { vertices: rect(1, 1, 2, 1), sheetId: plan });
    const sheetCutId = sheetCut.geometries.find((g) => g.id !== sheetParent)?.id ?? "";
    const viewportParent = `pgeo_vp_${randomUUID().slice(0, 8)}`;
    await db("precon_geometries").insert({
      id: viewportParent,
      row_id: rowId,
      sheet_id: plan,
      kind: "area",
      vertices: JSON.stringify(rect(101, 101, 4, 4)),
      source: "manual",
      quantity: 4,
      unit: "m2",
      definition: JSON.stringify({
        schemaVersion: 1,
        role: "measurement",
        tool: "area",
        shape: { role: "path", start: [m(101), m(101)], segments: [], closed: true },
        scale: { source: "viewport", viewportId: "vp_detail", sheetVersion: 1, appliedMmPerPt: 25 },
      }),
    });
    // 24 m² on the sheet + 4 m² in the region (4 m × 4 m of points at 25 mm/pt = 2 m × 2 m)
    await apply({ kind: "update-geometry", geometryId: sheetParent, vertices: rect(0, 0, 6, 4) });
    assert.equal((await rowOf(rowId)).gross, 28, "24 + 4 across two shapes at two scales");

    // An opening inside the region, linked to the region-bound parent.
    const regionCutId = `pgeo_rc_${randomUUID().slice(0, 8)}`;
    await db("precon_geometries").insert({
      id: regionCutId,
      row_id: rowId,
      sheet_id: plan,
      kind: "deduction",
      parent_geometry_id: viewportParent,
      vertices: JSON.stringify(rect(101.5, 101.5, 2, 2)),
      source: "manual",
      quantity: 1,
      unit: "m2",
      definition: JSON.stringify({
        schemaVersion: 1,
        role: "deduction",
        parentGeometryId: viewportParent,
        mode: "area",
        shape: { role: "path", start: [m(101.5), m(101.5)], segments: [], closed: true },
      }),
    });
    const current = await rowOf(rowId);
    await db("precon_boq_rows")
      .where({ id: rowId })
      .update({
        deductions: JSON.stringify([
          ...current.deductions,
          { label: "Region void", qty: 1, geometryId: regionCutId, unit: "m2", unitConfirmed: true },
        ]),
      });

    const shown = await preview().calibration(fixture.sessionId, plan, { newScaleMmPerPt: 100 });
    const line = shown.affectedRows.find((r) => r.rowId === rowId);
    assert.ok(line);
    assert.equal(line.newQtyGross, 96 + 4, "only the sheet-bound shape moves; the region-bound one holds at 4");
    assert.equal(
      line.newQty,
      100 - 8 - 1,
      "and only the sheet-bound opening is re-cut: the region's opening follows ITS parent and stays 1",
    );

    await apply({ kind: "apply-calibration", sheetId: plan, mmPerPt: 100, previewToken: shown.previewToken });
    assert.equal((await cutOf(rowId, sheetCutId))?.qty, 8, "the sheet opening quadrupled");
    assert.equal((await cutOf(rowId, regionCutId))?.qty, 1, "the region opening did not move");
    assert.equal((await rowOf(rowId)).qty, 100 - 8 - 1, "and the apply equals the preview exactly");
  });

  test("a region re-scale re-cuts only the openings whose parent is in that region", async () => {
    const plan = await sheet("cut_vp", 23, [
      { id: "vp_a", label: "A", rect: [m(100), m(100), m(140), m(140)], scaleMmPerPt: 25 },
    ]);
    const inRegion = await create(plan, "area", rect(101, 101, 4, 4));
    const rowId = inRegion.rows[0]!.id;
    assert.equal((await rowOf(rowId)).gross, 4, "4 m x 4 m of points at 25 mm/pt is 2 m x 2 m");
    const opening = await cut(rowId, "Region void", { vertices: rect(101.5, 101.5, 2, 2), sheetId: plan });
    const openingId = opening.geometries.find((g) => g.id !== inRegion.geometries[0]!.id)?.id ?? "";
    assert.equal((await cutOf(rowId, openingId))?.qty, 1, "1 m x 1 m at the region's scale");

    const version = await sheetVersion(plan);
    const doubled: SheetViewportInput[] = [
      { id: "vp_a", label: "A", rect: [m(100), m(100), m(140), m(140)], scaleMmPerPt: 50 },
    ];
    const shown = await preview().viewports(fixture.sessionId, plan, { version, viewports: doubled });
    const line = shown.rescaled.find((entry) => entry.rowId === rowId);
    assert.ok(line, "the region's line is named");
    assert.equal(line.newQtyGross, 16, "doubling the region's scale quadruples its area");
    assert.equal(line.newQty, 16 - 4, "and the opening inside it quadruples too");

    await apply({
      kind: "apply-viewports",
      sheetId: plan,
      viewports: doubled,
      previewToken: shown.previewToken,
    });
    assert.equal((await cutOf(rowId, openingId))?.qty, 4, "the opening followed its parent's region");
    assert.equal((await rowOf(rowId)).qty, 12, "and the apply equals the preview");
  });

  test("an opening drawn across the edge of its region still follows its parent, not where it sits", async () => {
    const plan = await sheet("cut_edge", 24, [
      { id: "vp_e", label: "Edge", rect: [m(200), m(200), m(210), m(210)], scaleMmPerPt: 25 },
    ]);
    // The parent itself spans the region edge, so it is measured wholly at the
    // region's scale only because the QS said so.
    const parent = await create(plan, "area", rect(205, 205, 10, 10), {
      scaleChoice: { source: "viewport", viewportId: "vp_e" },
    });
    const rowId = parent.rows[0]!.id;
    // The cut lies inside that parent but straddles the region boundary at 210.
    // Measured by where it SITS it would span two scales; the only right answer
    // is the parent's binding.
    const straddling = await cut(rowId, "Edge void", { vertices: rect(208, 208, 3, 3), sheetId: plan });
    const cutId = straddling.geometries.find((g) => g.id !== parent.geometries[0]!.id)?.id ?? "";
    const before = (await cutOf(rowId, cutId))?.qty ?? 0;
    assert.ok(before > 0, "the straddling cut has a figure");

    const version = await sheetVersion(plan);
    const doubled: SheetViewportInput[] = [
      { id: "vp_e", label: "Edge", rect: [m(200), m(200), m(210), m(210)], scaleMmPerPt: 50 },
    ];
    const shown = await preview().viewports(fixture.sessionId, plan, { version, viewports: doubled });
    const line = shown.rescaled.find((entry) => entry.rowId === rowId);
    assert.ok(line);
    await apply({ kind: "apply-viewports", sheetId: plan, viewports: doubled, previewToken: shown.previewToken });
    assert.equal(
      (await cutOf(rowId, cutId))?.qty,
      before * 4,
      "it followed the region its PARENT records, even though part of it lies outside",
    );
    assert.equal((await rowOf(rowId)).qty, line.newQty, "and the apply equals the preview");
  });
});
