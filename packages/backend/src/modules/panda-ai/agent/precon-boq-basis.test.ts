// What Panda AI can actually say about a measured quantity, read off a real
// database rather than a mapper held in isolation.
//
// The plan's own fixture is the case that failed: 24 m² drawn, a 2 m² cut-out,
// ×2 typical floors, billed 44. The read tool reported the tool and the gross
// and nothing else, so a PM asking "why is this 44 and not 48" got back the two
// numbers that do not answer it. The only other source was the
// `measurement_basis` sentence — prose, which must never be parsed back into a
// figure (contract 3).
//
// Every claim here is a claim about persistence and about SQL: that the openings
// and the repeat survive a round trip, that a line measured at two scales
// reports BOTH rather than whichever drawing happened to be newest, that a
// tombstoned drawing and another project's bill stay out, and that a line which
// never recorded a basis still says so instead of being handed a default. A
// fake cannot make any of them, so this runs against the real migrated
// database and fails rather than skips when none is configured.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "../pdf-takeoff/editor-db-fixture.ts";
import { editorOperationService } from "../pdf-takeoff/editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "../pdf-takeoff/editor-operation-types.ts";
import { preconRepository } from "../pdf-takeoff/repository.ts";
import { preconService } from "../pdf-takeoff/service.ts";
import { agentRepository } from "./repository.ts";
import { preconBoqLines, type PreconBoqLine } from "./precon-boq.ts";

let db: Knex;
let fixture: EditorFixture;
let other: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "boqbasis");
  other = await seedEditorFixture(db, "boqbasis-other");
});

after(async () => {
  if (other) await dropEditorFixture(db, other);
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand, on: EditorFixture = fixture): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(on.sessionId, { operationId: `op_${randomUUID()}`, command }, on.actor, GRANTS);

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

/** One 6 m × 4 m slab: 24 m² gross on the fixture's calibrated sheet. */
const slab = (label: string, at: number, on: EditorFixture = fixture): Promise<OperationReceipt> =>
  apply(
    {
      kind: "create-geometry",
      sheetId: on.sheetId,
      tool: "area",
      vertices: rect(0, at, 6, 4),
      description: `${label} ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    },
    on,
  );

/** The project's draft bill exactly as `get_precon_boq` serves it. */
const asPandaAiReads = (projectId: string): Promise<PreconBoqLine[]> =>
  preconBoqLines(agentRepository(db), projectId);

async function lineFor(rowId: string, projectId = fixture.projectId): Promise<PreconBoqLine> {
  const description = await db("precon_boq_rows").where({ id: rowId }).first<{ description: string }>("description");
  assert.ok(description, `line ${rowId} exists`);
  const line = (await asPandaAiReads(projectId)).find((candidate) => candidate.description === description.description);
  assert.ok(line, `line ${rowId} is in what Panda AI reads`);
  return line;
}

/** The newest measuring drawing of a line, as the editor recorded it. */
async function newestShapeId(rowId: string): Promise<string> {
  const shape = await db("precon_geometries")
    .where({ row_id: rowId, source: "manual" })
    .whereNot("kind", "deduction")
    .whereNull("deleted_at")
    .orderBy("created_at", "desc")
    .first<{ id: string }>("id");
  assert.ok(shape, "the line has a live measuring drawing");
  return shape.id;
}

describe("the basis explains the figure it is beside", () => {
  test("24 m² less a 2 m² opening, ×2 typical floors, is reported as the 44 it bills", async () => {
    const rowId = (await slab("Ground slab", 0)).rows[0]!.id;
    await apply({
      kind: "add-deduction",
      rowId,
      label: "Lift pit",
      mode: "area",
      vertices: rect(1, 1, 2, 1),
      sheetId: fixture.sheetId,
    });
    await apply({ kind: "set-row-typical", rowId, typical: 2 });

    const line = await lineFor(rowId);
    assert.equal(line.quantityGross, 24, "the figure measured on the drawing");
    assert.equal(line.deductionsTotal, 2, "the opening netted off it");
    assert.equal(line.typical, 2, "and the floors it repeats over");
    assert.equal(line.quantity, 44, "which is the 44 the line bills");
    assert.equal(
      (line.quantityGross! - line.deductionsTotal) * line.typical,
      line.quantity,
      "the fields Panda AI is given reproduce the billed figure without touching the basis sentence",
    );

    const opening = line.deductions[0]!;
    assert.equal(opening.label, "Lift pit", "named, so the answer can quote it");
    assert.equal(opening.qty, 2);
    assert.equal(opening.unit, "m2", "in the unit of the line it comes off");
    assert.equal(opening.mode, "area", "rejoined from the opening's own record, never re-derived from the unit");
    assert.equal(line.tool, "area");
    assert.equal(line.measurementCount, 1, "one drawing, which is what says the figure was measured at all");
    assert.equal(line.hasUnknownBasis, false);
  });

  test("the scale and the take-off revision the figure was taken on come with it", async () => {
    const rowId = (await slab("Scaled slab", 20)).rows[0]!.id;

    const line = await lineFor(rowId);
    assert.equal(line.scales.length, 1, "one drawing, one scale");
    assert.deepEqual(line.scales[0], { source: "sheet", viewportId: null, sheetVersion: 1, mmPerPt: 50 });
    assert.equal(line.measurementCount, 1);
    assert.equal(line.sourceRevision, 1, "the first measurement of this drawing");
    assert.equal(line.supersededByNewerRevision, false, "and nothing has replaced it");
  });

  test("the names a repeating line stands for are served, not re-invented", async () => {
    const rowId = (await slab("Named bays", 40)).rows[0]!.id;
    await apply({ kind: "set-measurement-settings", rowId, repeatLabels: ["Bay 1", "Bay 2", "Bay 3"] });

    const line = await lineFor(rowId);
    assert.deepEqual(line.repeatLabels, ["Bay 1", "Bay 2", "Bay 3"]);
    assert.equal(line.typical, 3, "three names is three bays");
    assert.equal(line.quantity, 72, "24 m² × 3");
  });

  test("a figure stated in words reports what was stated, and is not called basis-unknown", async () => {
    const stated = await preconService(preconRepository(db), noop).createStatedMeasurement(
      fixture.sessionId,
      { tool: "area", qty: 7.5, description: `Stated pour ${randomUUID().slice(0, 6)}`, elementGroup: "Slabs" },
      fixture.actor,
    );

    const line = await lineFor(stated.id);
    assert.equal(line.quantityMode, "stated", "a reader can tell it was never drawn");
    assert.equal(line.tool, "area", "from the record of what was stated, not from the sentence");
    assert.equal(line.measurementCount, 0, "there is no drawing to point at");
    assert.deepEqual(line.scales, [], "and nothing was measured at a scale");
    assert.equal(
      line.hasUnknownBasis,
      false,
      "its basis IS recorded — flagging it would send a QS looking for a drawing that was never meant to exist",
    );
  });
});

describe("a line measured more than once states every scale, not the newest one", () => {
  test("both bindings are reported, newest first, and neither is dropped", async () => {
    const keepId = (await slab("Two-shape slab", 60)).rows[0]!.id;
    const secondRowId = (await slab("Donor slab", 80)).rows[0]!.id;
    const movingId = await newestShapeId(secondRowId);
    await apply({ kind: "reassign-geometry", geometryId: movingId, targetRowId: keepId });

    // The OLDER drawing is restated as one taken inside a viewport region — a
    // real persisted shape (`editor-scale-binding` writes exactly this when an
    // outline starts in a viewport). It is the older one on purpose: the read
    // this replaces kept only the newest drawing, so a viewport scale in this
    // position is precisely what used to vanish from the answer.
    const olderId = await db("precon_geometries")
      .where({ row_id: keepId, source: "manual" })
      .whereNot("kind", "deduction")
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")
      .first<{ id: string; definition: Record<string, unknown> }>("id", "definition")
      .then((shape) => {
        assert.ok(shape, "the line kept its first drawing");
        return db("precon_geometries")
          .where({ id: shape.id })
          .update({
            definition: JSON.stringify({
              ...shape.definition,
              scale: { source: "viewport", viewportId: "pvp_detail", sheetVersion: 2, appliedMmPerPt: 25 },
            }),
          })
          .then(() => shape.id);
      });
    assert.ok(olderId);

    const line = await lineFor(keepId);
    assert.equal(line.measurementCount, 2, "the line is measured by two drawings");
    assert.equal(line.scales.length, 2, "so it has two scales and neither is the whole answer");
    assert.deepEqual(line.scales[0], { source: "sheet", viewportId: null, sheetVersion: 1, mmPerPt: 50 });
    assert.deepEqual(line.scales[1], { source: "viewport", viewportId: "pvp_detail", sheetVersion: 2, mmPerPt: 25 });
  });

  test("a drawing whose scale cannot be read contributes none rather than a default", async () => {
    const rowId = (await slab("Half-written scale", 100)).rows[0]!.id;
    const shapeId = await newestShapeId(rowId);
    const shape = await db("precon_geometries").where({ id: shapeId }).first<{ definition: Record<string, unknown> }>("definition");
    await db("precon_geometries")
      .where({ id: shapeId })
      .update({ definition: JSON.stringify({ ...shape!.definition, scale: { source: "sheet", sheetVersion: 1 } }) });

    const line = await lineFor(rowId);
    assert.deepEqual(line.scales, [], "an unreadable binding is no binding; 1:100 is never invented");
    assert.equal(line.tool, "area", "while what the record DOES say still comes through");
  });
});

describe("a basis that was never recorded is reported as missing, never filled in", () => {
  test("a legacy drawing leaves the line flagged for factor review with no guessed factor or unit", async () => {
    const rowId = (await slab("Legacy slab", 120)).rows[0]!.id;
    await apply({ kind: "set-row-typical", rowId, typical: 2 });
    await db("precon_geometries").where({ id: await newestShapeId(rowId) }).update({ definition: null });

    const line = await lineFor(rowId);
    assert.equal(line.tool, null, "nothing was stored, so nothing is guessed");
    assert.equal(line.heightM, null);
    assert.equal(line.depthM, null);
    assert.deepEqual(line.scales, [], "and no scale is attributed to it");
    assert.equal(line.assembly, null);
    assert.equal(line.hasUnknownBasis, true, "measured, but its basis cannot be resolved: it needs a person");
    assert.equal(line.measurementCount, 1, "the drawing is still there — it is its RECORD that is missing");
    assert.equal(line.typical, 2, "what the line does record is still reported");
    assert.equal(line.quantityMode, null, "a line that recorded no settings records none; that is not 'measured'");
  });

  test("a record no reader can parse is dropped, and nothing it contained reaches the answer", async () => {
    const rowId = (await slab("Unreadable slab", 140)).rows[0]!.id;
    await db("precon_geometries")
      .where({ id: await newestShapeId(rowId) })
      .update({ definition: JSON.stringify({ schemaVersion: 9, role: "nonsense", secret: "never serve this" }) });

    const line = await lineFor(rowId);
    assert.equal(line.tool, null);
    assert.equal(line.hasUnknownBasis, true);
    assert.equal(JSON.stringify(line).includes("never serve this"), false, "nothing undeclared is passed on");
  });
});

describe("what the answer may not contain", () => {
  test("a withdrawn drawing is not part of the basis, and a withdrawn line is not in the bill", async () => {
    const keepId = (await slab("Kept slab", 160)).rows[0]!.id;
    const donorId = (await slab("Withdrawn shape donor", 180)).rows[0]!.id;
    const movingId = await newestShapeId(donorId);
    await apply({ kind: "reassign-geometry", geometryId: movingId, targetRowId: keepId });
    await apply({ kind: "delete-geometry", geometryId: movingId });

    assert.equal((await lineFor(keepId)).measurementCount, 1, "the tombstone is kept for the audit, not for the bill");

    const goneRowId = (await slab("Withdrawn slab", 200)).rows[0]!.id;
    const goneDescription = (await db("precon_boq_rows").where({ id: goneRowId }).first<{ description: string }>("description"))!;
    await apply({ kind: "delete-geometry", geometryId: await newestShapeId(goneRowId) });

    const lines = await asPandaAiReads(fixture.projectId);
    assert.equal(
      lines.some((line) => line.description === goneDescription.description),
      false,
      "a line withdrawn with its last measurement is no longer part of what the bill claims",
    );
  });

  test("another project's measurements never appear in this project's bill", async () => {
    const mineId = (await slab("Mine", 220)).rows[0]!.id;
    const theirsId = (await slab("Theirs", 220, other)).rows[0]!.id;
    const mine = (await db("precon_boq_rows").where({ id: mineId }).first<{ description: string }>("description"))!;
    const theirs = (await db("precon_boq_rows").where({ id: theirsId }).first<{ description: string }>("description"))!;

    const lines = await asPandaAiReads(fixture.projectId);
    assert.ok(lines.some((line) => line.description === mine.description), "this project's line is here");
    assert.equal(
      lines.some((line) => line.description === theirs.description),
      false,
      "and the other project's is not",
    );

    const shapes = await agentRepository(db).preconBoqShapes(fixture.projectId);
    const theirRowIds = new Set(
      (await db("precon_boq_rows as row")
        .join("precon_bills as bill", "bill.id", "row.bill_id")
        .where("bill.session_id", other.sessionId)
        .select<{ id: string }[]>("row.id")).map((row) => row.id),
    );
    assert.equal(
      shapes.some((shape) => theirRowIds.has(shape.row_id)),
      false,
      "nor do its drawings reach this project's basis",
    );
  });
});
