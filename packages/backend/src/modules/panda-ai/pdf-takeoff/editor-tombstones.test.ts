// Contract 20: a withdrawn line is evidence, not data.
//
// Soft deletion only works if EVERY reader agrees about it. One surface that
// still counts a tombstone produces a total nobody can reconcile — a bill whose
// lines sum to one figure and whose summary shows another — and the audit trail
// makes it look deliberate. So this walks the whole read model on one fixture:
// withdraw a line, assert every surface has dropped it, restore it, assert every
// surface has it back.
//
// It also pins the two ways a restore can go wrong: bringing back a shape a
// DIFFERENT operation withdrew, and bringing the line back under a new id.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { preconBoqLine } from "../agent/precon-boq.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { diffTakeoffAgainstEstimate } from "./apply-to-estimate.ts";
import { measurementLines } from "./export-measurements.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-tombstones");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};

function service(): ReturnType<typeof preconService> {
  return preconService(preconRepository(db), noop);
}

function apply(command: EditorCommand): Promise<OperationReceipt> {
  return editorOperationService(db, noop).apply(
    fixture.sessionId,
    { operationId: `op_${randomUUID()}`, command },
    fixture.actor,
    GRANTS,
  );
}

function room(offsetM: number): number[][] {
  return [
    [m(offsetM), m(0)],
    [m(offsetM + 6), m(0)],
    [m(offsetM + 6), m(4)],
    [m(offsetM), m(4)],
  ];
}

async function measureRoom(label: string, offsetM: number): Promise<OperationReceipt> {
  return apply({
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "area",
    vertices: room(offsetM),
    description: label,
    elementGroup: "Slabs",
    rate: 1000,
  });
}

/** Every read-model surface contract 20 names, answered for one session. */
async function readModel(): Promise<{
  snapshotRowIds: string[];
  snapshotGeometryIds: string[];
  summaryTotal: number;
  progressTotal: number;
  exportDescriptions: string[];
  csvBodyLines: number;
  estimateCandidateIds: string[];
  agentDescriptions: string[];
}> {
  const api = service();
  const snapshot = await api.getSnapshot(fixture.sessionId);
  const csv = await api.exportCsv(fixture.sessionId);
  const preview = diffTakeoffAgainstEstimate(fixture.sessionId, snapshot.bills, snapshot.rows, []);
  const agentRows = await db("precon_boq_rows as r")
    .join("precon_bills as b", "b.id", "r.bill_id")
    .where("b.session_id", fixture.sessionId)
    .whereNull("r.deleted_at")
    .select("r.id", "r.description", "r.unit", "r.qty", "r.rate", "r.amount", "r.status", "r.measurement_basis");
  return {
    snapshotRowIds: snapshot.rows.map((row) => row.id),
    snapshotGeometryIds: snapshot.geometries.map((geometry) => geometry.id),
    summaryTotal: snapshot.summary.measuredTotal,
    progressTotal: snapshot.progress.total,
    exportDescriptions: measurementLines(snapshot).map((line) => line.description),
    csvBodyLines: csv.csv.trim().split("\n").length - 1,
    estimateCandidateIds: preview.items.map((item) => item.boqItemId).filter((id): id is string => Boolean(id)),
    agentDescriptions: agentRows.map((row) => preconBoqLine(row as never).description),
  };
}

describe("a withdrawn line disappears from every surface, and comes back to all of them", () => {
  test("the full reader matrix agrees before, during and after a withdrawal", async () => {
    const keep = await measureRoom(`Slab to keep ${randomUUID().slice(0, 6)}`, 0);
    const drop = await measureRoom(`Slab to withdraw ${randomUUID().slice(0, 6)}`, 10);
    const droppedRow = drop.rows[0]!.id;
    const droppedLabel = (await db("precon_boq_rows").where({ id: droppedRow }).first())!["description"] as string;
    const droppedGeometry = drop.geometries[0]!.id;

    const present = await readModel();
    assert.ok(present.snapshotRowIds.includes(droppedRow), "both lines are on the bill to start with");
    assert.ok(present.snapshotGeometryIds.includes(droppedGeometry));
    assert.ok(present.exportDescriptions.includes(droppedLabel), "and in the measurements export");
    assert.ok(present.estimateCandidateIds.includes(droppedRow), "and offered to the estimate");
    assert.ok(present.agentDescriptions.includes(droppedLabel), "and visible to Panda AI");

    await apply({ kind: "delete-geometry", geometryId: droppedGeometry });

    const gone = await readModel();
    const surfaces: [string, boolean][] = [
      ["snapshot rows", gone.snapshotRowIds.includes(droppedRow)],
      ["snapshot geometries", gone.snapshotGeometryIds.includes(droppedGeometry)],
      ["measurements export", gone.exportDescriptions.includes(droppedLabel)],
      ["estimate apply preview", gone.estimateCandidateIds.includes(droppedRow)],
      ["Panda AI read tool", gone.agentDescriptions.includes(droppedLabel)],
    ];
    for (const [surface, leaked] of surfaces) {
      assert.equal(leaked, false, `${surface} still shows a withdrawn line`);
    }
    assert.ok(gone.snapshotRowIds.includes(keep.rows[0]!.id), "the line nobody touched is untouched");
    assert.equal(gone.progressTotal, present.progressTotal - 1, "review progress counts one line fewer");
    assert.equal(
      gone.summaryTotal,
      Math.round((present.summaryTotal - 24000) * 100) / 100,
      "and the priced total drops by exactly the withdrawn line's amount (24 m2 × 1000)",
    );
    assert.equal(gone.csvBodyLines, present.csvBodyLines - 1, "the CSV export loses exactly one row");

    // The tombstone is still on the table — that is the whole point of one.
    assert.ok(await db("precon_boq_rows").where({ id: droppedRow }).first(), "the withdrawn line is retained");
    assert.ok(await db("precon_geometries").where({ id: droppedGeometry }).first(), "and so is its shape");

    await service().restoreRow(droppedRow, fixture.actor, { operationId: `op_${randomUUID()}` });

    const back = await readModel();
    assert.ok(back.snapshotRowIds.includes(droppedRow), "restoring puts the line back on the bill");
    assert.ok(back.snapshotGeometryIds.includes(droppedGeometry), "with its shape");
    assert.ok(back.exportDescriptions.includes(droppedLabel), "and back in the export");
    assert.ok(back.estimateCandidateIds.includes(droppedRow), "and back in the estimate preview");
    assert.ok(back.agentDescriptions.includes(droppedLabel), "and back in Panda AI's answer");
    assert.equal(back.progressTotal, present.progressTotal, "progress is whole again");
    assert.equal(back.csvBodyLines, present.csvBodyLines, "and so is the CSV");
  });
});

describe("restoring a line does not resurrect what a different operation withdrew", () => {
  test("a shape deleted earlier stays deleted when the line is later restored", async () => {
    // A wall measured by two runs. One run is withdrawn on its own; later the
    // whole line is withdrawn and then restored. The first run must stay down —
    // nobody asked for it back, and bringing it back silently re-bills it.
    const created = await apply({
      kind: "create-geometry",
      sheetId: fixture.sheetId,
      tool: "area",
      vertices: room(30),
      description: `Two-shape slab ${randomUUID().slice(0, 6)}`,
      elementGroup: "Slabs",
    });
    const rowId = created.rows[0]!.id;
    const firstShape = created.geometries[0]!.id;

    const secondShape = `pgeo_${randomUUID()}`;
    await db("precon_geometries").insert({
      id: secondShape,
      row_id: rowId,
      sheet_id: fixture.sheetId,
      kind: "area",
      vertices: JSON.stringify(room(40)),
      source: "manual",
      quantity: 24,
      unit: "m2",
      definition: JSON.stringify({
        schemaVersion: 1,
        role: "measurement",
        tool: "area",
        shape: { role: "path", start: [m(40), m(0)], segments: [], closed: true },
        scale: { source: "sheet", sheetVersion: 1, appliedMmPerPt: 50 },
      }),
    });

    // step 1: withdraw the second run on its own
    await apply({ kind: "delete-geometry", geometryId: secondShape });
    assert.ok((await db("precon_geometries").where({ id: secondShape }).first())?.["deleted_at"], "the second run is down");
    assert.equal(
      (await db("precon_geometries").where({ id: firstShape }).first())?.["deleted_at"],
      null,
      "and the line survives on its first run",
    );

    // step 2: withdraw the whole line, then restore it
    await service().removeRow(rowId, fixture.actor, { operationId: `op_${randomUUID()}` });
    await service().restoreRow(rowId, fixture.actor, { operationId: `op_${randomUUID()}` });

    assert.equal(
      (await db("precon_geometries").where({ id: firstShape }).first())?.["deleted_at"],
      null,
      "the run the withdrawal took down is back",
    );
    assert.ok(
      (await db("precon_geometries").where({ id: secondShape }).first())?.["deleted_at"],
      "but the run withdrawn by the EARLIER, unrelated operation is still down",
    );
  });
});

describe("the assistant withdraws and restores, it never recreates", () => {
  test("an assistant delete then undo keeps the line's original id", async () => {
    const created = await measureRoom(`Assistant slab ${randomUUID().slice(0, 6)}`, 50);
    const rowId = created.rows[0]!.id;
    const api = service();

    await api.removeRow(rowId, fixture.actor, { operationId: `op_${randomUUID()}` });
    assert.equal(
      await db("precon_boq_rows").where({ id: rowId }).whereNull("deleted_at").first(),
      undefined,
      "withdrawn",
    );

    const restored = await api.restoreRow(rowId, fixture.actor, { operationId: `op_${randomUUID()}` });
    assert.equal(
      restored.id,
      rowId,
      "the line comes back under the id it had: estimate_items.boq_item_id and the audit trail both name it",
    );
    assert.equal(
      Number((await db("precon_boq_rows").where({ description: restored.description }).count("* as n").first())?.["n"]),
      1,
      "and there is exactly one of it, not an original tombstone plus a recreated copy",
    );
  });
});
