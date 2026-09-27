import assert from "node:assert/strict";
import { test } from "node:test";
import type { PreconGeometry } from "../../../api/precon.ts";
import { addOrOpen, expectedRowsFor, openWorkingCopy, selectOrOpen } from "./saved-edit-open.ts";

const geometry = (id: string, rowId: string, vertices: number[][]): PreconGeometry =>
  ({ id, rowId, sheetId: "sh_1", kind: "linear", vertices, source: "manual", quantity: 7, unit: "m" }) as PreconGeometry;

const LINE = geometry("g_1", "row_1", [
  [0, 0],
  [60, 0],
  [60, 80],
]);
const OTHER = geometry("g_2", "row_1", [
  [0, 0],
  [10, 10],
]);

test("opening a working copy pins the row version it was opened on", () => {
  // Given a row at v82 on the server
  // When the user opens its shape for editing
  const edit = openWorkingCopy(LINE, 1, null, 82);
  // Then the copy carries that version as its baseline
  assert.equal(edit.baseVersion, 82);
  assert.equal(edit.rowId, "row_1");
  assert.deepEqual(edit.vertices, LINE.vertices);
});

test("the working copy's vertices are a copy, so the cached geometry is never mutated", () => {
  // Given a working copy opened from the cached geometry
  const edit = openWorkingCopy(LINE, 0, null, 82);
  // When the copy is edited in place
  edit.vertices[0]![0] = 999;
  // Then the geometry React Query holds is untouched
  assert.deepEqual(LINE.vertices[0], [0, 0]);
});

test("picking another point of the SAME shape keeps the pinned version and the edits so far", () => {
  // Given a working copy opened at v82 and since edited
  const open = openWorkingCopy(LINE, 1, null, 82);
  const edited = { ...open, vertices: [[0, 0], [60, 0]], operationId: "op_1" };
  // When the user picks a different point of that same shape, while the cache
  // has meanwhile moved on to v83 (a colleague committed)
  const rebased = openWorkingCopy(LINE, 0, null, 83);
  const next = selectOrOpen(edited, LINE.id, 0, rebased);
  // Then the baseline is still v82 and the staged edit survives
  assert.equal(next.baseVersion, 82, "selecting a point must not rebase onto the colleague's version");
  assert.deepEqual(next.vertices, [[0, 0], [60, 0]]);
  assert.equal(next.selectedVertex, 0);
  assert.equal(next.operationId, "op_1");
});

test("toggling add-at-end on the same shape keeps the pinned version", () => {
  // Given a working copy opened at v82
  const open = openWorkingCopy(LINE, null, null, 82);
  // When the user toggles Continue-at-end while the cache reads v90
  const next = addOrOpen(open, LINE.id, "end", openWorkingCopy(LINE, null, null, 90));
  // Then the baseline is unchanged and the mode is on
  assert.equal(next.baseVersion, 82);
  assert.equal(next.addingAt, "end");
  // And toggling it again only clears the mode
  assert.equal(addOrOpen(next, LINE.id, "end", openWorkingCopy(LINE, null, null, 91)).baseVersion, 82);
  assert.equal(addOrOpen(next, LINE.id, "end", openWorkingCopy(LINE, null, null, 91)).addingAt, null);
});

test("moving to a DIFFERENT shape adopts the freshly opened copy and its version", () => {
  // Given a working copy of one shape at v82
  const open = openWorkingCopy(LINE, 1, null, 82);
  // When the user starts editing another shape, read at v83
  const next = selectOrOpen(open, OTHER.id, 0, openWorkingCopy(OTHER, 0, null, 83));
  // Then that is a new working copy on the version it was opened at
  assert.equal(next.geometryId, "g_2");
  assert.equal(next.baseVersion, 83);
  assert.equal(next.operationId, null);
});

test("with no working copy open, picking a point opens one", () => {
  // Given nothing being edited
  // When a point is picked
  const next = selectOrOpen(null, LINE.id, 2, openWorkingCopy(LINE, 2, null, 82));
  // Then the copy is the freshly opened one
  assert.equal(next.baseVersion, 82);
  assert.equal(next.selectedVertex, 2);
});

test("a pinned baseline becomes the expectedRows version check the server enforces", () => {
  // Given a copy pinned at v82
  // When a command is built for it
  // Then the version check names exactly that version
  assert.deepEqual(expectedRowsFor("row_1", 82), [{ id: "row_1", version: 82 }]);
});

test("an unknown baseline sends NO version check rather than a guessed one", () => {
  // Given a working copy whose row version could not be read
  // When a command is built for it
  // Then no expectation is sent — a guessed version is what overwrites a colleague
  assert.deepEqual(expectedRowsFor("row_1", null), []);
});
