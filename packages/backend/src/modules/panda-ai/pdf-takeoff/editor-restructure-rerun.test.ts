import assert from "node:assert/strict";
import { test } from "node:test";
import { preconBoqLine } from "../agent/precon-boq.ts";
import type { PreconBoqQueryRow } from "../agent/takeoff-repository.ts";
import { validateDefinitionV1 } from "./editor-types.ts";
import { isReplaceableByRerun, planRegisterSheets } from "./dwg-rerun.ts";
import { reassignMismatch, removeSegmentFrom, splitVerticesAt, unionShapes } from "./editor-batch-rules.ts";
import { measureVertices, polygonAreaM2, polylineLengthM } from "./measurements.ts";
import { SHEET_KIND } from "./types.ts";
import type { PreconBoqRowRow, PreconSheetRow } from "./types.ts";
import { AREA_RECT, AT, MM_PER_UNIT, POLYLINE_PATH, SESSION_ID, TEST_SHEET, WALL_ROW } from "./editor-regression-fixtures.ts";

// ---------- re-calibration: what a corrected sheet scale does to a figure ----------
//
// The stored vertices are sheet points, never metres, so the scale is the only
// thing that turns them into a quantity. It enters a length once and an area
// twice, which is why a 1:100 sheet read as 1:50 understates every run by half
// and every floor by three quarters — and why a count, which multiplies the
// scale by nothing at all, must come back identical.

test("calibration: doubling scale doubles polyline length", () => {
  const at1000 = polylineLengthM(POLYLINE_PATH, MM_PER_UNIT);
  const at2000 = polylineLengthM(POLYLINE_PATH, MM_PER_UNIT * 2);
  assert.equal(at1000, 7, "3 m across + 4 m up at 1 unit = 1 m");
  assert.equal(at2000, 2 * at1000, "the same run on a sheet at twice the scale is twice as long");
});

test("calibration: doubling scale quadruples area", () => {
  const at1000 = polygonAreaM2(AREA_RECT, MM_PER_UNIT);
  const at2000 = polygonAreaM2(AREA_RECT, MM_PER_UNIT * 2);
  assert.equal(at1000, 24, "6 m × 4 m at 1 unit = 1 m");
  assert.equal(at2000, 4 * at1000, "the scale enters both sides of an area, so it squares");
});

test("calibration: count is scale-free", () => {
  const MARKS = [
    [0, 0],
    [5, 5],
    [9, 1],
  ];
  for (const mmPerPt of [1, MM_PER_UNIT, MM_PER_UNIT * 2, 17.68]) {
    const measured = measureVertices("count", MARKS, mmPerPt);
    assert.equal(measured.gross, MARKS.length, `three marks stay three marks at ${mmPerPt} mm per point`);
    assert.equal(measured.base, MARKS.length);
    assert.equal(measured.unit, "nr");
  }
});

test("deduction definition is accepted", () => {
  const definition = validateDefinitionV1({
    schemaVersion: 1,
    role: "deduction",
    parentGeometryId: "pgeo_wall_1",
    mode: "wall-opening",
    dimensions: { widthM: 1.2, heightM: 1.5 },
  });
  assert.equal(definition.role, "deduction");
  if (definition.role !== "deduction") return;
  assert.equal(definition.parentGeometryId, "pgeo_wall_1", "a deduction names the wall it comes out of");
  assert.equal(definition.mode, "wall-opening");
  assert.equal(definition.dimensions?.widthM, 1.2);
  assert.equal(definition.dimensions?.heightM, 1.5);
});

// ---------- restructuring: split, trim, merge, reassign ----------
//
// These four change the SHAPE of a take-off rather than a figure in it, and
// each has one arithmetic promise it must keep. A split re-describes a run and
// never changes what it measures. A trim that would leave two disconnected
// runs is refused, because a bill line cannot be two separate measurements. A
// merge measures the shared strip once. A reassignment only moves a drawing
// between lines that mean the same thing.

test("splitPolyline: split at vertex 1 of [[0,0],[3,0],[3,4]] gives 3m+4m=7m", () => {
  const original = measureVertices("polyline", POLYLINE_PATH, MM_PER_UNIT);
  const { left, right } = splitVerticesAt(POLYLINE_PATH, 1);
  assert.deepEqual(left, [[0, 0], [3, 0]], "the cut point stays on the first piece");
  assert.deepEqual(right, [[3, 0], [3, 4]], "and starts the second, so nothing is dropped");

  const leftPiece = measureVertices("polyline", left, MM_PER_UNIT);
  const rightPiece = measureVertices("polyline", right, MM_PER_UNIT);
  assert.equal(leftPiece.gross, 3);
  assert.equal(rightPiece.gross, 4);
  assert.equal(
    Math.round((leftPiece.gross + rightPiece.gross) * 100) / 100,
    original.gross,
    "3 m + 4 m is still the 7 m run that was signed off",
  );

  // The first and the last vertex cut nothing off, so neither is a split.
  assert.throws(() => splitVerticesAt(POLYLINE_PATH, 0), /cut nothing off/i);
  assert.throws(() => splitVerticesAt(POLYLINE_PATH, 2), /cut nothing off/i);
});

test("removeSegment: an interior cut yields the two runs it actually leaves", () => {
  const RUN = [
    [0, 0],
    [3, 0],
    [3, 4],
    [7, 4],
  ];
  // Taking the middle side out leaves two runs, and BOTH stay on the line: a
  // length removed from the middle of a wall does not delete the rest of it.
  // The previous contract returned null here and the caller refused the edit.
  assert.deepEqual(
    removeSegmentFrom(RUN, 1),
    [
      [[0, 0], [3, 0]],
      [[3, 4], [7, 4]],
    ],
    "the 3 m start and the 4 m end survive, with no edge bridging the gap",
  );
  assert.deepEqual(removeSegmentFrom(RUN, 0), [[[3, 0], [3, 4], [7, 4]]], "taking the first side out trims the start");
  assert.deepEqual(removeSegmentFrom(RUN, 2), [[[0, 0], [3, 0], [3, 4]]], "taking the last side out trims the end");
  assert.throws(() => removeSegmentFrom(RUN, 3), /not one of the 3 drawn/i);
});

test("mergeGeometries: polygonUnion of two touching squares gives correct area", () => {
  const west: [number, number][] = [[0, 0], [3, 0], [3, 3], [0, 3]];
  const east: [number, number][] = [[3, 0], [6, 0], [6, 3], [3, 3]];
  assert.equal(polygonAreaM2(west, MM_PER_UNIT), 9);
  assert.equal(polygonAreaM2(east, MM_PER_UNIT), 9);

  const merged = unionShapes([west, east]);
  assert.equal(merged.length, 1, "two rooms sharing a wall are one outline");
  assert.equal(merged[0]!.holes.length, 0, "with no void in it");
  assert.equal(polygonAreaM2(merged[0]!.outer, MM_PER_UNIT), 18, "two 3 m × 3 m rooms sharing a wall are one 6 m × 3 m outline");
  assert.equal(measureVertices("area", merged[0]!.outer, MM_PER_UNIT).gross, 18, "and the merged line bills that one figure");

  // Areas that do not touch stay SEPARATE outlines rather than being refused or
  // joined by an invented edge: the line carries both drawings.
  const detached: [number, number][] = [[20, 20], [23, 20], [23, 23], [20, 23]];
  const apart = unionShapes([west, detached]);
  assert.equal(apart.length, 2, "two outlines, not one bridged shape and not a refusal");
  assert.equal(
    apart.reduce((sum, shape) => sum + polygonAreaM2(shape.outer, MM_PER_UNIT), 0),
    18,
    "and together they are 9 + 9",
  );
});

test("reassignGeometry: reject if units differ", () => {
  const source = { unit: "m2", tool: "area" as const, typical: 1 };
  assert.equal(reassignMismatch(source, { ...source }), null, "same unit, tool and typical: the drawing may move");
  assert.match(reassignMismatch(source, { ...source, unit: "m3" }) ?? "", /different units \(m2 against m3\)/);
  assert.match(reassignMismatch(source, { ...source, tool: "volume" }) ?? "", /different tools \(area against volume\)/);
  assert.match(reassignMismatch(source, { ...source, typical: 4 }) ?? "", /typical floors \(1 against 4\)/);
});

// ---------------------------------------------------------------------------
// Re-running the detection
// ---------------------------------------------------------------------------
// A re-run used to wipe every AI row and every sheet of the session. That is
// safe only on a take-off nobody has opened: once a QS has corrected, priced,
// signed off or withdrawn a line — or pinned a comment on a drawing — those
// are the records the bill is defended with. The two tests below pin the
// predicate that decides what a re-run may throw away, and the sheet plan that
// keeps the ids everything else names.

const rerunRow = (over: Partial<Pick<PreconBoqRowRow, "origin" | "status" | "deleted_at">>) => ({
  origin: "ai" as const,
  status: "ai_generated" as const,
  deleted_at: null,
  ...over,
});

test("rerun: AI-only row should be replaced; edited row should be preserved", () => {
  assert.equal(isReplaceableByRerun(rerunRow({})), true, "the engine drafted it and nobody has touched it");

  assert.equal(isReplaceableByRerun(rerunRow({ status: "needs_review" })), false, "flagged for a person to look at");
  assert.equal(isReplaceableByRerun(rerunRow({ status: "verified" })), false, "signed off by a named person");
  assert.equal(isReplaceableByRerun(rerunRow({ status: "rejected" })), false, "rejecting it was itself a decision");
  assert.equal(isReplaceableByRerun(rerunRow({ status: null })), false, "an unreadable status is not a licence to delete");

  assert.equal(isReplaceableByRerun(rerunRow({ origin: "manual" })), false, "a person measured this one by hand");
  assert.equal(isReplaceableByRerun(rerunRow({ origin: "prompt" })), false, "asked for through Panda AI, not drafted");

  assert.equal(
    isReplaceableByRerun(rerunRow({ deleted_at: AT })),
    false,
    "a tombstone is the standing instruction not to reintroduce the line; deleting it would let the next run bring it back",
  );
  assert.equal(isReplaceableByRerun({ ...WALL_ROW }), false, "the verified hand-measured wall survives every re-run");
});

test("rerun: a sheet with surviving evidence is restated in place, and sheet ids stay stable", () => {
  const window = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  const register = [
    { id: 1, code: "GA-01", title: "Ground floor", kind: SHEET_KIND.FLOOR_PLAN, bounds: window, levelMm: null, multiplier: 1 },
    { id: 2, code: "EL-01", title: "North elevation", kind: "elevation", bounds: window, levelMm: null, multiplier: 1 },
  ];
  const pagedTwo: PreconSheetRow = { ...TEST_SHEET, id: "pcsh_2", page_number: 2, code: "OLD-02", title: "Old page 2" };
  const plan = planRegisterSheets({
    sessionId: SESSION_ID,
    fileName: TEST_SHEET.file_name,
    storagePath: TEST_SHEET.storage_path,
    units: { unit: "mm", scaleToMm: MM_PER_UNIT, errorPct: 0, note: "read from the model space" },
    sheets: register,
    sheetsOnly: false,
    existing: [TEST_SHEET, pagedTwo],
    // only page 1 still carries a measurement or a pin
    survivingIds: new Set([TEST_SHEET.id]),
  });

  assert.deepEqual(plan.restate.map((s) => s.id), [TEST_SHEET.id], "the drawing with evidence on it is never deleted");
  assert.equal(plan.restate[0]?.patch.code, "GA-01", "but it does take the re-run's reading of the register");

  assert.deepEqual(plan.insert.map((s) => s.id), [pagedTwo.id], "page 2 was pruned, so it comes back under the id it had");
  assert.equal(plan.insert[0]?.code, "EL-01");
  assert.equal(plan.insert[0]?.status, "unmeasurable", "an elevation is read for context, not measured");

  assert.equal(plan.idBySourceId.get(1), TEST_SHEET.id, "the engine's drawing 1 is still sheet 1");
  assert.equal(plan.idBySourceId.get(2), pagedTwo.id);

  const fresh = planRegisterSheets({
    sessionId: SESSION_ID,
    fileName: "OTHER.dwg",
    storagePath: "plans/OTHER.dwg",
    units: { unit: "mm", scaleToMm: MM_PER_UNIT, errorPct: 0, note: "" },
    sheets: [register[0]!],
    sheetsOnly: false,
    existing: [TEST_SHEET, pagedTwo],
    survivingIds: new Set([TEST_SHEET.id]),
  });
  assert.equal(fresh.restate.length, 0, "a different source file is a genuinely new drawing");
  assert.equal(fresh.insert.length, 1);
  assert.notEqual(fresh.insert[0]?.id, TEST_SHEET.id, "so it mints an id rather than stealing one");
});

// ---------------------------------------------------------------------------
// What Panda AI can see of a measurement
// ---------------------------------------------------------------------------
// A net quantity alone cannot answer "which lines need a factor checked".
// The tool and its factor live in the geometry's definition, so the read tool
// has to carry them through — and say so honestly when they were never stored.

const queryRow = (over: Partial<PreconBoqQueryRow>): PreconBoqQueryRow => ({
  id: "pbr_regression",
  session_id: SESSION_ID,
  session_title: "GA-01 take-off",
  session_status: "reviewing",
  session_revision: 1,
  session_superseded_by: null,
  element_group: null,
  code: null,
  description: "",
  qty: null,
  qty_gross: null,
  unit: null,
  rate: null,
  amount: null,
  status: null,
  confidence: null,
  measurement_basis: null,
  deductions: [],
  typical: 1,
  measurement_settings: null,
  ...over,
});

test("preconBoqRows tool: definition is exposed when present", () => {
  const measured = preconBoqLine(
    queryRow({
      element_group: "External walls",
      code: "F10/110",
      description: "Blockwork to external walls",
      qty: "18.90",
      qty_gross: "18.90",
      unit: "m2",
      status: "verified",
      confidence: "high",
      measurement_basis: WALL_ROW.measurement_basis,
    }),
    [
      {
        schemaVersion: 1,
        role: "measurement",
        tool: "wall_area",
        shape: { role: "path", start: [0, 0], segments: [{ kind: "line", end: [7, 0] }], closed: false },
        factor: { heightM: 2.7 },
      },
    ],
  );
  assert.equal(measured.tool, "wall_area");
  assert.equal(measured.heightM, 2.7);
  assert.equal(measured.depthM, null, "a wall area has no depth");
  assert.equal(measured.quantityGross, 18.9, "the drawn figure, not just the net");
  assert.equal(measured.hasUnknownBasis, false);

  const unrecorded = preconBoqLine(
    queryRow({
      element_group: "External walls",
      description: "Blockwork measured before the definition was stored",
      qty: 18.9,
      qty_gross: 18.9,
      unit: "m2",
      status: "ai_generated",
      confidence: "low",
      measurement_basis: "measured off GA-01",
    }),
    [null],
  );
  assert.equal(unrecorded.tool, null, "nothing was stored, so nothing is guessed");
  assert.equal(unrecorded.heightM, null);
  assert.equal(unrecorded.hasUnknownBasis, true, "measured, but the basis cannot be resolved: it needs factor review");

  const unmeasured = preconBoqLine(
    queryRow({
      description: "Provisional sum for statutory fees",
      amount: 250000,
      status: "ai_generated",
      confidence: "high",
    }),
  );
  assert.equal(unmeasured.hasUnknownBasis, false, "a line that was never measured is not a line with a missing basis");
});
