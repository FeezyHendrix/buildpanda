// What a re-scale refuses to guess about an opening.
//
// A cutout is defined as a hole in a particular shape. If that shape records
// nothing about how it was measured, the opening cannot be re-measured either —
// and an opening left at its old figure beside a slab restated at a new scale is
// a line whose parts were measured at two different scales, which reads as a
// number and means nothing.
//
// So the whole change stops. Not the line, not the opening: the change.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
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

const { apply, preview, rowOf, cutOf, sheetVersion, sheet, create } = cutoutRig(
  () => db,
  () => fixture,
);

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "cutblocks");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

describe("what a re-scale refuses to guess about an opening", () => {
  test("an opening whose parent records no basis blocks the whole apply", async () => {
    const plan = await sheet("cut_leg", 25);
    const parentId = `pgeo_legp_${randomUUID().slice(0, 8)}`;
    const rowId = `pbr_legp_${randomUUID().slice(0, 8)}`;
    const cutId = `pgeo_legc_${randomUUID().slice(0, 8)}`;
    await db("precon_boq_rows").insert({
      id: rowId,
      bill_id: fixture.billId,
      sort: 980,
      row_type: "item",
      description: "Legacy slab with an opening",
      unit: "m2",
      qty_gross: 24,
      deductions: JSON.stringify([{ label: "Void", qty: 2, geometryId: cutId, unit: "m2", unitConfirmed: true }]),
      qty: 22,
      version: 1,
      measurement_basis: "24 m2 on CUT_LEG",
      origin: "migrated",
      status: "verified",
    });
    await db("precon_geometries").insert({
      id: parentId,
      row_id: rowId,
      sheet_id: plan,
      kind: "area",
      vertices: JSON.stringify(rect(0, 60, 6, 4)),
      source: "ai",
      quantity: 24,
      unit: "m2",
      definition: null,
    });
    await db("precon_geometries").insert({
      id: cutId,
      row_id: rowId,
      sheet_id: plan,
      kind: "deduction",
      parent_geometry_id: parentId,
      vertices: JSON.stringify(rect(1, 61, 2, 1)),
      source: "ai",
      quantity: 2,
      unit: "m2",
      definition: null,
    });

    const shown = await preview().calibration(fixture.sessionId, plan, { newScaleMmPerPt: 100 });
    assert.equal(shown.blocked, true, "the preview says the apply is blocked");
    assert.ok(shown.unresolvedRowIds.includes(rowId));

    await assert.rejects(
      apply({ kind: "apply-calibration", sheetId: plan, mmPerPt: 100, previewToken: shown.previewToken }),
      BadRequestError,
      "an opening off a shape with no recorded basis cannot be re-cut, so nothing may be written",
    );
    assert.equal((await rowOf(rowId)).gross, 24, "nothing moved");
    assert.equal((await cutOf(rowId, cutId))?.qty, 2);
  });

  test("a region change that cannot re-cut an opening is refused, never applied in part", async () => {
    const plan = await sheet("cut_vpleg", 26, [
      { id: "vp_l", label: "L", rect: [m(300), m(300), m(340), m(340)], scaleMmPerPt: 25 },
    ]);
    const good = await create(plan, "area", rect(301, 301, 4, 4));
    const goodRow = good.rows[0]!.id;
    const legacyRow = `pbr_vpleg_${randomUUID().slice(0, 8)}`;
    const legacyParent = `pgeo_vplegp_${randomUUID().slice(0, 8)}`;
    await db("precon_boq_rows").insert({
      id: legacyRow,
      bill_id: fixture.billId,
      sort: 981,
      row_type: "item",
      description: "Legacy inside the region",
      unit: "m2",
      qty_gross: 4,
      deductions: JSON.stringify([]),
      qty: 4,
      version: 1,
      measurement_basis: "4 m2",
      origin: "migrated",
      status: "verified",
    });
    await db("precon_geometries").insert({
      id: legacyParent,
      row_id: legacyRow,
      sheet_id: plan,
      kind: "area",
      vertices: JSON.stringify(rect(302, 302, 4, 4)),
      source: "ai",
      quantity: 4,
      unit: "m2",
      definition: null,
    });

    const version = await sheetVersion(plan);
    const doubled: SheetViewportInput[] = [
      { id: "vp_l", label: "L", rect: [m(300), m(300), m(340), m(340)], scaleMmPerPt: 50 },
    ];
    const shown = await preview().viewports(fixture.sessionId, plan, { version, viewports: doubled });
    assert.equal(shown.blocked, true, "an unclassified line inside the region blocks the change");
    assert.ok(shown.unresolvedRowIds.includes(legacyRow), "and the preview names it");

    await assert.rejects(
      apply({ kind: "apply-viewports", sheetId: plan, viewports: doubled, previewToken: shown.previewToken }),
      BadRequestError,
      "applying the region change would restate one line and leave the other silently wrong",
    );
    assert.equal((await rowOf(goodRow)).gross, 4, "the resolvable line was not restated either");
    assert.equal(
      Number((await db("precon_sheets").where({ id: plan }).first())?.["viewports"][0].scaleMmPerPt),
      25,
      "and the region kept its scale",
    );
  });
});
