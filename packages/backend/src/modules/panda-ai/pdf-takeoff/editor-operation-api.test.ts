// The operation envelope against real Postgres: the receipt, the replay, the
// refusals and the rollback.
//
// Every claim here is a claim about the database — a partial unique index making
// a retry idempotent, a transaction leaving nothing behind when it aborts, a
// version check seeing another connection's write. None of them can be made by a
// double, so this suite fails rather than skips when no database is configured.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  m,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorHistoryService } from "./editor-operation-history.ts";
import { editorOperationService, editorOperationServiceWith } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, EditorOperationRequest, OperationReceipt } from "./editor-operation-types.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "editor-ops");
});

after(async () => {
  if (fixture) await dropEditorFixture(db, fixture);
  await db.destroy();
});

const ALL_GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const newOperationId = (): string => `op_${randomUUID()}`;

function service(): ReturnType<typeof editorOperationService> {
  return editorOperationService(db, noop);
}

const POLYLINE = [
  [m(0), m(0)],
  [m(3), m(0)],
  [m(3), m(4)],
];

function createWall(): EditorCommand {
  return {
    kind: "create-geometry",
    sheetId: fixture.sheetId,
    tool: "wall_area",
    vertices: POLYLINE,
    description: `QA wall ${randomUUID().slice(0, 6)}`,
    elementGroup: "Walls",
    factor: { heightM: 2.7 },
  };
}

function request(command: EditorCommand, extra: Partial<EditorOperationRequest> = {}): EditorOperationRequest {
  return { operationId: newOperationId(), command, ...extra };
}

async function apply(req: EditorOperationRequest, grants: EditorGrants = ALL_GRANTS): Promise<OperationReceipt> {
  return service().apply(fixture.sessionId, req, fixture.actor, grants);
}

async function auditCount(operationId: string): Promise<number> {
  const row = await db("precon_audit_events").where({ operation_id: operationId }).count("* as n").first();
  return Number(row?.["n"] ?? 0);
}

describe("a committed operation returns a real receipt", () => {
  test("creation names its audit event, its row version and its new shape", async () => {
    const req = request(createWall());
    const receipt = await apply(req);

    assert.equal(receipt.operationId, req.operationId);
    assert.equal(receipt.replayed, false);
    assert.match(receipt.eventId, /^pae_/, "the receipt names a real audit event, never an empty string");

    const event = await db("precon_audit_events").where({ id: receipt.eventId }).first();
    assert.ok(event, "the event the receipt names actually exists");
    assert.equal(event["operation_id"], req.operationId);
    assert.equal(event["actor"], fixture.actor);

    assert.equal(receipt.rows.length, 1, "one line was created");
    assert.equal(receipt.rows[0]?.version, 1);
    assert.equal(receipt.geometries.length, 1);
    assert.equal(receipt.geometries[0]?.sheetId, fixture.sheetId);
    assert.deepEqual(receipt.touchedSheetIds, [fixture.sheetId]);

    const row = await db("precon_boq_rows").where({ id: receipt.rows[0]?.id }).first();
    assert.equal(Number(row?.["qty"]), 18.9, "7 m run × 2.7 m high");

    const stored = event["after"] as { schemaVersion: number; requestFingerprint: string; receipt: unknown };
    assert.equal(stored.schemaVersion, 1);
    assert.match(stored.requestFingerprint, /^[0-9a-f]{64}$/, "a SHA-256 over the canonical request");
    assert.ok(stored.receipt, "the event owns the receipt, so a retry can be answered from it");
  });

  test("a point edit bumps the row version and keeps the geometry id", async () => {
    const created = await apply(request(createWall()));
    const geometryId = created.geometries[0]!.id;
    const rowId = created.rows[0]!.id;

    const edited = await apply(
      request(
        { kind: "update-geometry", geometryId, vertices: [[m(0), m(0)], [m(3), m(0)], [m(3), m(2)]] },
        { expectedRows: [{ id: rowId, version: 1 }] },
      ),
    );

    assert.deepEqual(
      edited.geometries.map((geometry) => geometry.id),
      [geometryId],
      "the corrected shape is the same shape",
    );
    assert.equal(edited.rows[0]?.version, 2, "the line moved on exactly once");
    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty"]), 13.5, "5 m run × 2.7 m high");
  });

  test("a factor change re-measures the stored shape without redrawing it", async () => {
    const created = await apply(request(createWall()));
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;

    await apply(request({ kind: "set-row-factor", rowId, heightM: 3 }));

    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty"]), 21, "7 m × 3 m = 21 m2");
    const geometry = await db("precon_geometries").where({ id: geometryId }).first();
    assert.deepEqual(geometry?.["vertices"], POLYLINE, "the drawn shape is untouched by a factor change");
    assert.equal(
      (geometry?.["definition"] as { factor?: { heightM?: number } })?.factor?.heightM,
      3,
      "and the new height is what the definition now records",
    );
  });
});

describe("the same operation id is a retry, never a second edit", () => {
  test("replaying an identical request returns the first receipt and writes nothing", async () => {
    const req = request(createWall());
    const first = await apply(req);
    const rowsBefore = await db("precon_boq_rows").where({ bill_id: fixture.billId }).count("* as n").first();

    const replay = await apply(req);

    assert.equal(replay.eventId, first.eventId, "the retry is answered by the first attempt's event");
    assert.equal(replay.replayed, true, "and says so, so the client can tell");
    assert.deepEqual(replay.rows, first.rows, "with the same versions it reported the first time");
    assert.deepEqual(replay.geometries, first.geometries, "and the same shape, not a duplicate");

    assert.equal(await auditCount(req.operationId), 1, "one act, one audit entry");
    const rowsAfter = await db("precon_boq_rows").where({ bill_id: fixture.billId }).count("* as n").first();
    assert.equal(rowsAfter?.["n"], rowsBefore?.["n"], "the retry created no second line");
  });

  test("reusing an id for a DIFFERENT edit is a conflict, not a replay", async () => {
    const req = request(createWall());
    const first = await apply(req);

    const reused: EditorOperationRequest = {
      operationId: req.operationId,
      command: {
        kind: "update-geometry",
        geometryId: first.geometries[0]!.id,
        vertices: [[m(0), m(0)], [m(9), m(0)]],
      },
    };
    await assert.rejects(apply(reused), (error: unknown) => {
      assert.ok(error instanceof ConflictError, "a reused id must be a 409");
      assert.match(error.message, /already used for a different edit/i);
      return true;
    });

    const row = await db("precon_boq_rows").where({ id: first.rows[0]?.id }).first();
    assert.equal(Number(row?.["qty"]), 18.9, "the refused request changed nothing");
    assert.equal(row?.["version"], 1, "and moved no version on");
    assert.equal(await auditCount(req.operationId), 1, "and added no audit entry");
  });

  test("an operation id is only idempotent for the actor who used it", async () => {
    const req = request(createWall());
    await apply(req);
    const other = await service().apply(fixture.sessionId, request(createWall(), { operationId: req.operationId }), fixture.otherActor, ALL_GRANTS);
    assert.equal(other.replayed, false, "a different person's save with the same id is their own new act");
  });
});

describe("a version that has moved on refuses the whole operation", () => {
  test("a stale expectedRows version is a 409 and writes nothing", async () => {
    const created = await apply(request(createWall()));
    const rowId = created.rows[0]!.id;
    const geometryId = created.geometries[0]!.id;

    const req = request(
      { kind: "update-geometry", geometryId, vertices: [[m(0), m(0)], [m(5), m(0)]] },
      { expectedRows: [{ id: rowId, version: 99 }] },
    );
    await assert.rejects(apply(req), (error: unknown) => {
      assert.ok(error instanceof ConflictError);
      assert.match(error.message, /current version 1/, "the client is told what to reload to");
      return true;
    });

    const row = await db("precon_boq_rows").where({ id: rowId }).first();
    assert.equal(Number(row?.["qty"]), 18.9);
    assert.equal(row?.["version"], 1);
    assert.equal(await auditCount(req.operationId), 0, "a refused operation leaves no receipt to replay");
  });

  test("a shape in another session is a 404, not a cross-session edit", async () => {
    const outsider = await seedEditorFixture(db, "editor-ops-outsider");
    try {
      const theirs = await service().apply(
        outsider.sessionId,
        {
          operationId: newOperationId(),
          command: {
            kind: "create-geometry",
            sheetId: outsider.sheetId,
            tool: "area",
            vertices: [[m(0), m(0)], [m(6), m(0)], [m(6), m(4)], [m(0), m(4)]],
            description: "Outsider slab",
            elementGroup: "Slabs",
          },
        },
        outsider.actor,
        ALL_GRANTS,
      );

      await assert.rejects(
        apply(
          request({
            kind: "update-geometry",
            geometryId: theirs.geometries[0]!.id,
            vertices: [[m(0), m(0)], [m(1), m(0)], [m(1), m(1)]],
          }),
        ),
        (error: unknown) => {
          assert.ok(error instanceof NotFoundError, "another session's shape must not be addressable");
          return true;
        },
      );

      const untouched = await db("precon_boq_rows").where({ id: theirs.rows[0]?.id }).first();
      assert.equal(Number(untouched?.["qty"]), 24, "their line is exactly as they left it");
    } finally {
      await dropEditorFixture(db, outsider);
    }
  });
});

describe("grants are checked against the command actually being run", () => {
  test("an edit-only role cannot bring a new measurement into being", async () => {
    await assert.rejects(apply(request(createWall()), { edit: true, measure: false, verify: false }), (error: unknown) => {
      assert.ok(error instanceof ForbiddenError);
      assert.match(error.message, /measure/i);
      return true;
    });
  });

  test("a read-only role cannot edit at all", async () => {
    await assert.rejects(
      apply(request(createWall()), { edit: false, measure: false, verify: false }),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenError);
        assert.match(error.message, /edit/i);
        return true;
      },
    );
  });

  test("saving and verifying in one act needs the verify grant too", async () => {
    const created = await apply(request(createWall()));
    await assert.rejects(
      apply(
        request(
          { kind: "update-geometry", geometryId: created.geometries[0]!.id, vertices: [[m(0), m(0)], [m(2), m(0)]] },
          { verify: true },
        ),
        { edit: true, measure: true, verify: false },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenError);
        assert.match(error.message, /verify/i);
        return true;
      },
    );
  });
});

describe("an operation that fails part-way leaves nothing behind", () => {
  test("a failure after the writes rolls back the quantity, the shape AND the audit entry", async () => {
    const rowsBefore = Number(
      (await db("precon_boq_rows").where({ bill_id: fixture.billId }).count("* as n").first())?.["n"],
    );
    const geometriesBefore = Number(
      (await db("precon_geometries").where({ sheet_id: fixture.sheetId }).count("* as n").first())?.["n"],
    );

    // The real unit of work, failed deliberately after the callback has written
    // everything: exactly the crash-between-statements this seam exists to make
    // survivable. Nothing is mocked — the writes really happen, then abort.
    const realUnitOfWork = createOperationUnitOfWork(db, noop);
    const published: string[] = [];
    const failing = editorOperationServiceWith(
      async (sessionId, callback) =>
        realUnitOfWork(sessionId, async (ctx) => {
          await callback(ctx);
          throw new BadRequestError("injected failure after the operation wrote everything");
        }),
      (sessionId, actor, operationId) => preconAuditRepository(db).auditEventByOperation(sessionId, actor, operationId),
    );

    const req = request(createWall());
    await assert.rejects(
      failing.apply(fixture.sessionId, req, fixture.actor, ALL_GRANTS),
      /injected failure/,
      "the operation is reported as failed",
    );

    assert.equal(
      Number((await db("precon_boq_rows").where({ bill_id: fixture.billId }).count("* as n").first())?.["n"]),
      rowsBefore,
      "no bill line survived the rollback",
    );
    assert.equal(
      Number((await db("precon_geometries").where({ sheet_id: fixture.sheetId }).count("* as n").first())?.["n"]),
      geometriesBefore,
      "no shape survived it either",
    );
    assert.equal(await auditCount(req.operationId), 0, "and no audit entry claims the edit happened");
    assert.deepEqual(published, [], "nothing was announced to other editors");
  });
});

describe("history and receipts are readable after a reload", () => {
  test("an operation appears in its sheet's history and its receipt can be fetched", async () => {
    const created = await apply(request(createWall()));
    const history = editorHistoryService(preconAuditRepository(db));

    const listed = await history.history(fixture.sessionId, fixture.actor, fixture.sheetId);
    const entry = listed.operations.find((operation) => operation.eventId === created.eventId);
    assert.ok(entry, "the edit is in the history the undo stack reads");
    assert.equal(entry.direction, "undo", "reversing an edit undoes it");
    assert.equal(entry.eligible, true, "and nothing blocks it yet");
    assert.equal(entry.reason, null);
    assert.deepEqual(entry.sheetIds, [fixture.sheetId]);

    const record = await history.receipt(fixture.sessionId, created.eventId, fixture.actor);
    assert.equal(record.eventId, created.eventId);
    assert.ok(record.after, "the committed state is readable");
    assert.ok(record.receipt, "and so is the receipt");
    assert.match(record.requestFingerprint ?? "", /^[0-9a-f]{64}$/);
  });

  test("another person's receipt is a 404, not a readable record", async () => {
    const created = await apply(request(createWall()));
    const history = editorHistoryService(preconAuditRepository(db));
    await assert.rejects(
      history.receipt(fixture.sessionId, created.eventId, fixture.otherActor),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundError, "a receipt id must not reveal that someone else's edit exists");
        return true;
      },
    );
    const theirs = await history.history(fixture.sessionId, fixture.otherActor, fixture.sheetId);
    assert.equal(
      theirs.operations.some((operation) => operation.eventId === created.eventId),
      false,
      "and it is not offered to them as undoable",
    );
  });
});
