// A redline is evidence, so withdrawing one is an operation like any other.
//
// Markups were the one class of record the editor could change without leaving
// a receipt: the endpoints versioned and audited them, but nothing tied them to
// the session lock, so a pin could move while a re-calibration was restating
// the drawing under it, and no undo could put it back.
//
// Three further holes this pins:
//
//   * `softDeleteMarkup(id, user, version?)` — the version was OPTIONAL. Omit
//     it and the withdrawal lands over whatever the pin had become.
//   * restoring a pin ran `restoreCommentsForMarkup(markupId)`, which resurrects
//     EVERY comment ever deleted on that pin, including ones withdrawn weeks
//     earlier and separately. Words nobody restored reappear on the sheet.
//   * reversing a withdrawal checked nothing about the discussion. If somebody
//     replied in between, the undo silently rewrote the thread they joined.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { Knex } from "knex";
import { ConflictError } from "../../../lib/errors.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import {
  connectTestDatabase,
  dropEditorFixture,
  seedEditorFixture,
  type EditorFixture,
} from "./editor-db-fixture.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorCommand, EditorGrants, OperationReceipt } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";

let db: Knex;
let fixture: EditorFixture;

const GRANTS: EditorGrants = { edit: true, measure: true, verify: true };
const noop = (): void => {};
const OTHER = "usr_other_voice";

before(async () => {
  db = connectTestDatabase();
  fixture = await seedEditorFixture(db, "markups");
  await db("user")
    .insert({ id: OTHER, name: "Other", email: `${OTHER}@qa.local`, "emailVerified": true, createdAt: new Date(), updatedAt: new Date() })
    .onConflict("id")
    .ignore();
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

async function reverse(eventId: string): Promise<{ reversed: boolean; reason?: string }> {
  const undoer = editorReverseServiceWith(createOperationUnitOfWork(db, noop), preconAuditRepository(db));
  const outcome = await undoer.reverseOperation(
    fixture.sessionId,
    eventId,
    { operationId: `op_${randomUUID()}` },
    fixture.actor,
    GRANTS,
  );
  return outcome.reversed ? { reversed: true } : { reversed: false, reason: outcome.reason };
}

async function pin(at: { x: number; y: number }): Promise<string> {
  const id = `mk_${randomUUID().slice(0, 12)}`;
  await db("drawing_markups").insert({
    id,
    precon_session_id: fixture.sessionId,
    precon_sheet_id: fixture.sheetId,
    kind: "pin",
    geometry: JSON.stringify({ kind: "pin", at, space: "points" }),
    color: "#004DE7",
    version: 1,
    created_by_id: fixture.actor,
  });
  return id;
}

async function comment(markupId: string, body: string, author: string): Promise<string> {
  const id = `mkc_${randomUUID().slice(0, 12)}`;
  await db("drawing_markup_comments").insert({
    id,
    markup_id: markupId,
    body,
    created_by_id: author,
    version: 1,
  });
  return id;
}

const markupRow = async (id: string) => db("drawing_markups").where({ id }).first();
const commentRow = async (id: string) => db("drawing_markup_comments").where({ id }).first();

describe("a redline change is an operation with a receipt", () => {
  test("moving a pin lands under the session lock, is versioned, and undoes", async () => {
    const markupId = await pin({ x: 10, y: 20 });

    const receipt = await apply({
      kind: "edit-markup",
      markupId,
      version: 1,
      geometry: { kind: "pin", at: { x: 80, y: 90 }, space: "points" },
    });
    assert.ok(receipt.eventId, "it is a real audit event");
    const moved = await markupRow(markupId);
    assert.equal(moved?.["geometry"]?.["at"]?.["x"], 80, "the pin moved");
    assert.equal(moved?.["version"], 2, "and was versioned");

    const undone = await reverse(receipt.eventId);
    assert.equal(undone.reversed, true, undone.reason ?? "");
    const back = await markupRow(markupId);
    assert.equal(back?.["geometry"]?.["at"]?.["x"], 10, "undo puts the pin back where it was");
  });

  test("a stale version is refused, and there is no way to skip sending one", async () => {
    const markupId = await pin({ x: 1, y: 1 });
    await assert.rejects(
      apply({ kind: "edit-markup", markupId, version: 99, geometry: { kind: "pin", at: { x: 2, y: 2 }, space: "points" } }),
      ConflictError,
    );
    assert.equal((await markupRow(markupId))?.["version"], 1, "nothing moved");

    // The withdrawal command carries a REQUIRED version. The service beneath it
    // used to accept `undefined` and delete whatever it found.
    await assert.rejects(
      apply({ kind: "delete-markup", markupId, version: 99 }),
      ConflictError,
      "a withdrawal aimed at a version that is no longer current is refused",
    );
    assert.equal((await markupRow(markupId))?.["deleted_at"], null, "and the pin is still on the sheet");
  });

  test("quantities are untouched by a redline operation", async () => {
    const markupId = await pin({ x: 5, y: 5 });
    const rows = await db("precon_boq_rows").where({ bill_id: fixture.billId }).orderBy("id");
    await apply({ kind: "edit-markup", markupId, version: 1, color: "#FF0000" });
    const after = await db("precon_boq_rows").where({ bill_id: fixture.billId }).orderBy("id");
    assert.deepEqual(
      after.map((r) => [r["id"], r["qty"], r["version"], r["status"]]),
      rows.map((r) => [r["id"], r["qty"], r["version"], r["status"]]),
      "not one line moved, versioned or lost a sign-off",
    );
  });
});

describe("withdrawing a pin, and what comes back", () => {
  test("only the comments withdrawn WITH it are restored, never ones deleted before", async () => {
    const markupId = await pin({ x: 30, y: 30 });
    const early = await comment(markupId, "Withdrawn on its own, weeks ago", fixture.actor);
    const live = await comment(markupId, "Still standing", fixture.actor);

    // One comment is taken down separately and long before the pin.
    await db("drawing_markup_comments").where({ id: early }).update({ deleted_at: new Date(Date.now() - 86_400_000) });

    const receipt = await apply({ kind: "delete-markup", markupId, version: 1 });
    assert.ok((await markupRow(markupId))?.["deleted_at"], "the pin is withdrawn");
    assert.ok((await commentRow(live))?.["deleted_at"], "and the live comment went with it");

    const undone = await reverse(receipt.eventId);
    assert.equal(undone.reversed, true, undone.reason ?? "");
    assert.equal((await markupRow(markupId))?.["deleted_at"], null, "the pin is back");
    assert.equal((await commentRow(live))?.["deleted_at"], null, "with the comment withdrawn alongside it");
    assert.ok(
      (await commentRow(early))?.["deleted_at"],
      "but NOT the one somebody had already taken down — restoring a pin is not an amnesty",
    );
  });

  test("a reply added after the withdrawal blocks the undo rather than rewriting the thread", async () => {
    const markupId = await pin({ x: 40, y: 40 });
    await comment(markupId, "Opening note", fixture.actor);
    const receipt = await apply({ kind: "delete-markup", markupId, version: 1 });

    // Somebody joins the discussion on the restored-but-not-yet-restored pin.
    await comment(markupId, "I have a question about this", OTHER);

    const outcome = await reverse(receipt.eventId);
    assert.equal(outcome.reversed, false, "the undo is refused");
    assert.match(String(outcome.reason), /repl|discussion|comment/i, "and says the discussion moved on");
    assert.ok((await markupRow(markupId))?.["deleted_at"], "the pin stays withdrawn until a person decides");
  });

  test("an unresolved thread with two voices cannot be withdrawn at all", async () => {
    const markupId = await pin({ x: 50, y: 50 });
    await comment(markupId, "Opening note", fixture.actor);
    await comment(markupId, "Replying", OTHER);
    await assert.rejects(
      apply({ kind: "delete-markup", markupId, version: 1 }),
      (error: unknown) => {
        assert.match(String((error as Error).message), /discussion|resolve/i);
        return true;
      },
    );
    assert.equal((await markupRow(markupId))?.["deleted_at"], null, "nothing was taken off the sheet");
  });
});

describe("comment text stays with its author", () => {
  test("another participant cannot rewrite it, and the author's edit is versioned and reversible", async () => {
    const markupId = await pin({ x: 60, y: 60 });
    const commentId = await comment(markupId, "Original wording", OTHER);

    await assert.rejects(
      apply({ kind: "edit-comment", markupId, commentId, version: 1, body: "Rewritten by someone else" }),
      (error: unknown) => {
        assert.match(String((error as Error).message), /author/i);
        return true;
      },
      "only the person who wrote it may reword it",
    );
    assert.equal((await commentRow(commentId))?.["body"], "Original wording");

    const mine = await comment(markupId, "My note", fixture.actor);
    const receipt = await apply({ kind: "edit-comment", markupId, commentId: mine, version: 1, body: "My note, clarified" });
    assert.equal((await commentRow(mine))?.["body"], "My note, clarified");
    assert.equal((await commentRow(mine))?.["version"], 2, "versioned");

    const undone = await reverse(receipt.eventId);
    assert.equal(undone.reversed, true, undone.reason ?? "");
    assert.equal((await commentRow(mine))?.["body"], "My note", "and the original wording comes back");
  });
});
