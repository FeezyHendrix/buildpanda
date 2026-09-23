// A deduction is measured in the dimension its line is billed in, or refused.
//
// The vertices branch derived the tool from the PARENT's unit
// (`deductionToolFor(row.unit)`) and then checked the measured unit against that
// same parent unit — a check that can never fail, because both sides come from
// the same place. The caller's declared `mode` was read only in the stated
// branch, so on the vertices branch it was dropped entirely.
//
// The observed result, from the independent verifier's live probe: a caller
// asked to take **2 m² off a 7 m run**. The server measured the rectangle's
// four points as an open path — 2 + 1 + 2 = 5 — deducted **5 m**, turned the
// 7 m line into 2 m, rewrote the declared `mode: "area"` to `"length"`, and
// stamped the result `unitConfirmed: true`. Nothing in the record afterwards
// says the figure means something other than what the QS asked for.
//
// So a declared mode is now honoured: it must agree with the dimension the line
// is billed in, or the write is refused before anything moves. It is never
// silently rewritten. Where no mode is declared nothing changes — four points on
// a line billed in metres is a legitimate three-segment run, and the server
// cannot tell that from a rectangle without being told.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError } from "../../../lib/errors.ts";
import { connectTestDatabase, dropEditorFixture, m, seedEditorFixture, type EditorFixture } from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import type { Deduction, MeasureFactor, MeasureTool } from "./types.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "ded-dim");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const apply = (command: EditorCommand): Promise<OperationReceipt> =>
  editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );

const rowOf = async (rowId: string): Promise<Record<string, unknown>> =>
  (await db("precon_boq_rows").where({ id: rowId }).first()) as Record<string, unknown>;

const netOf = async (rowId: string): Promise<number> => Number((await rowOf(rowId))["qty"]);
const unitOf = async (rowId: string): Promise<string> => String((await rowOf(rowId))["unit"]);
const cutsOf = async (rowId: string): Promise<Deduction[]> => (await rowOf(rowId))["deductions"] as Deduction[];

const rect = (x: number, y: number, w: number, h: number): number[][] => [
  [m(x), m(y)],
  [m(x + w), m(y)],
  [m(x + w), m(y + h)],
  [m(x), m(y + h)],
];

async function line(tool: MeasureTool, vertices: number[][], label: string, factor?: MeasureFactor): Promise<string> {
  const created = await apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool,
    vertices,
    description: `${label} ${randomUUID().slice(0, 6)}`,
    elementGroup: "Mixed",
    ...(factor ? { factor } : {}),
  });
  return created.rows[0]!.id;
}

/** A refusal that changed nothing: the figure, the unit and the openings all stand. */
async function refuses(rowId: string, command: EditorCommand, pattern: RegExp): Promise<void> {
  const before = await rowOf(rowId);
  await assert.rejects(apply(command), (error: unknown) => {
    assert.ok(error instanceof BadRequestError, `expected a refusal, got ${String(error)}`);
    assert.match(error.message, pattern);
    return true;
  });
  const after = await rowOf(rowId);
  assert.equal(Number(after["qty"]), Number(before["qty"]), "the billed figure did not move");
  assert.equal(Number(after["qty_gross"]), Number(before["qty_gross"]), "nor the gross");
  assert.equal(after["unit"], before["unit"], "nor the unit it is billed in");
  assert.equal(after["version"], before["version"], "and the line was not versioned by a refusal");
  assert.deepEqual(after["deductions"], before["deductions"], "no opening was recorded");
}

describe("a declared mode must agree with the dimension the line is billed in", () => {
  test("square metres cannot be taken off a line billed in metres", async () => {
    const rowId = await line("polyline", [[0, 0], [m(7), 0]], "Skirting run");
    assert.equal(await netOf(rowId), 7);
    assert.equal(await unitOf(rowId), "m");

    await refuses(
      rowId,
      { kind: "add-deduction", rowId, label: "Square metres off a line", mode: "area", vertices: rect(1, 1, 2, 1), sheetId: fixture.sheetId },
      /metre|m\b.*area|area.*m\b/i,
    );
    assert.equal(await netOf(rowId), 7, "the 7 m run is still a 7 m run");
  });

  test("metres cannot be taken off a line billed in square metres", async () => {
    const rowId = await line("area", rect(0, 20, 6, 4), "Slab");
    await refuses(
      rowId,
      { kind: "add-deduction", rowId, label: "Metres off a slab", mode: "length", vertices: rect(1, 21, 1, 1), sheetId: fixture.sheetId },
      /length|m2|m²/i,
    );
  });

  test("a tally and an area are not interchangeable, either way round", async () => {
    const counted = await line("count", [[m(0), m(40)], [m(1), m(40)], [m(2), m(40)]], "Sockets");
    assert.equal(await unitOf(counted), "nr");
    await refuses(
      counted,
      { kind: "add-deduction", rowId: counted, label: "Area off a tally", mode: "area", vertices: rect(0, 41, 1, 1), sheetId: fixture.sheetId },
      /count|nr/i,
    );

    const slab = await line("area", rect(0, 60, 6, 4), "Slab for tally");
    await refuses(
      slab,
      { kind: "add-deduction", rowId: slab, label: "A tally off a slab", mode: "count", vertices: rect(1, 61, 1, 1), sheetId: fixture.sheetId },
      /count|area|m2/i,
    );
  });

  test("a volume takes a volume, and still refuses an area", async () => {
    const rowId = await line("volume", rect(0, 80, 6, 4), "Slab pour", { depthM: 0.15 });
    assert.equal(await unitOf(rowId), "m3");
    assert.equal(await netOf(rowId), 3.6, "24 m² × 0.15 m");

    await refuses(
      rowId,
      { kind: "add-deduction", rowId, label: "Area off a volume", mode: "area", vertices: rect(1, 81, 2, 1), sheetId: fixture.sheetId },
      /volume|m3|m³/i,
    );

    await apply({
      kind: "add-deduction",
      rowId,
      label: "Riser box",
      mode: "volume",
      vertices: rect(1, 81, 2, 1),
      sheetId: fixture.sheetId,
    });
    assert.equal(await netOf(rowId), 3.3, "3.6 − (2 m² × 0.15 m): the parent's depth cuts the hole too");
  });
});

describe("the cases that were always right are untouched", () => {
  test("an area off an area, a length off a length, and an unstated mode all still work", async () => {
    const slab = await line("area", rect(0, 100, 6, 4), "Untouched slab");
    await apply({ kind: "add-deduction", rowId: slab, label: "Stated area", mode: "area", vertices: rect(1, 101, 1, 1), sheetId: fixture.sheetId });
    assert.equal(await netOf(slab), 23, "24 − 1");

    const run = await line("polyline", [[0, m(120)], [m(7), m(120)]], "Untouched run");
    await apply({ kind: "add-deduction", rowId: run, label: "Stated length", mode: "length", vertices: [[m(1), m(120)], [m(3), m(120)]], sheetId: fixture.sheetId });
    assert.equal(await netOf(run), 5, "7 − 2");

    // Four points on a line billed in metres is a legitimate three-segment run.
    // With no mode declared the server has not been told otherwise, so this is
    // the shipped behaviour and must not change.
    const unstated = await line("polyline", [[0, m(140)], [m(9), m(140)]], "Unstated mode run");
    await apply({
      kind: "add-deduction",
      rowId: unstated,
      label: "Three segments, no mode stated",
      vertices: [[m(1), m(140)], [m(2), m(140)], [m(2), m(141)], [m(3), m(141)]],
      sheetId: fixture.sheetId,
    });
    assert.equal(await netOf(unstated), 6, "9 − (1 + 1 + 1)");
    assert.equal((await cutsOf(unstated))[0]!.unit, "m");
  });

  test("a wall opening drawn on a wall billed in square metres is still an area", async () => {
    const wall = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "wall_area",
      vertices: [[0, m(160)], [m(7), m(160)]],
      description: `Wall ${randomUUID().slice(0, 6)}`,
      elementGroup: "Walls",
      factor: { heightM: 2.7 },
    });
    const rowId = wall.rows[0]!.id;
    assert.equal(await netOf(rowId), 18.9, "7 m × 2.7 m");

    await apply({
      kind: "add-deduction",
      rowId,
      label: "Window W1",
      mode: "wall-opening",
      dimensions: { widthM: 1.2, heightM: 1.5 },
    });
    assert.equal(await netOf(rowId), 17.1, "18.9 − 1.8");
  });
});

describe("correcting an opening cannot change its dimension either", () => {
  test("an edit that declares the wrong mode is refused, and the opening stands", async () => {
    const rowId = await line("area", rect(0, 180, 6, 4), "Edited slab");
    await apply({ kind: "add-deduction", rowId, label: "Void", mode: "area", vertices: rect(1, 181, 1, 1), sheetId: fixture.sheetId });
    assert.equal(await netOf(rowId), 23);
    const geometryId = (await cutsOf(rowId))[0]!.geometryId!;

    await refuses(
      rowId,
      { kind: "edit-deduction", rowId, geometryId, mode: "length", vertices: rect(1, 181, 2, 1) },
      /length|m2|m²/i,
    );
    assert.equal(await netOf(rowId), 23, "the opening is still the 1 m² it was");
  });
});
