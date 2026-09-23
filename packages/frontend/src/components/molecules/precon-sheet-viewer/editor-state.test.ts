import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canFinish,
  drawingTool,
  editorReducer,
  INITIAL_EDITOR_STATE,
  isDirty,
  isDrawing,
  saveError,
  selectedGeometryIds,
  type EditorAction,
  type EditorGesture,
  type EditorSelection,
  type EditorState,
} from "./editor-state.ts";
import {
  segmentAt,
  segmentCount,
  segmentLengthPt,
  segmentMidpoint,
  segmentsOf,
  splitSegment,
  vertexPairOfSegment,
} from "./segment-model.ts";

// ── the gesture machine ──────────────────────────────────────────────────────

test("idle → drawing on START_DRAWING", () => {
  const state = run({ type: "START_DRAWING", tool: "area" });
  const gesture = gestureOf(state, "drawing");
  assert.equal(gesture.tool, "area");
  assert.deepEqual(gesture.draftVertices, []);
  assert.equal(isDrawing(state), true);
  assert.equal(drawingTool(state), "area");
  assert.equal(state.historyHead, 0, "picking up a tool commits nothing");
});

test("drawing: ADD_DRAFT_VERTEX accumulates points", () => {
  const state = run(
    { type: "START_DRAWING", tool: "linear" },
    { type: "ADD_DRAFT_VERTEX", point: [10, 20] },
    { type: "ADD_DRAFT_VERTEX", point: [30, 40] },
    { type: "ADD_DRAFT_VERTEX", point: [50, 60] },
  );
  assert.deepEqual(gestureOf(state, "drawing").draftVertices, [
    [10, 20],
    [30, 40],
    [50, 60],
  ]);
});

test("a point placed with no tool in hand is dropped", () => {
  const state = editorReducer(INITIAL_EDITOR_STATE, { type: "ADD_DRAFT_VERTEX", point: [1, 1] });
  assert.equal(state, INITIAL_EDITOR_STATE, "no-op returns the same object");
  assert.equal(state.gesture.kind, "idle");
});

test("drawing: REMOVE_LAST_DRAFT_VERTEX removes last point", () => {
  const drawn = run(
    { type: "START_DRAWING", tool: "linear" },
    { type: "ADD_DRAFT_VERTEX", point: [0, 0] },
    { type: "ADD_DRAFT_VERTEX", point: [10, 0] },
  );
  const undone = editorReducer(drawn, { type: "REMOVE_LAST_DRAFT_VERTEX" });
  assert.deepEqual(gestureOf(undone, "drawing").draftVertices, [[0, 0]]);

  const emptied = editorReducer(undone, { type: "REMOVE_LAST_DRAFT_VERTEX" });
  assert.deepEqual(gestureOf(emptied, "drawing").draftVertices, []);
  // Nothing left to take back: the gesture survives, the state does not churn.
  assert.equal(editorReducer(emptied, { type: "REMOVE_LAST_DRAFT_VERTEX" }), emptied);
});

test("FINISH_DRAWING is no-op with fewer than 2 vertices", () => {
  const onePoint = run({ type: "START_DRAWING", tool: "length" }, { type: "ADD_DRAFT_VERTEX", point: [5, 5] });
  assert.equal(editorReducer(onePoint, { type: "FINISH_DRAWING" }), onePoint);
  assert.equal(gestureOf(onePoint, "drawing").draftVertices.length, 1);

  const twoPoints = editorReducer(onePoint, { type: "ADD_DRAFT_VERTEX", point: [25, 5] });
  const finished = editorReducer(twoPoints, { type: "FINISH_DRAWING" });
  assert.equal(finished.gesture.kind, "idle");
  assert.equal(finished.historyHead, 0, "the caller bumps history once the write lands, not the reducer");
});

test("CANCEL from drawing returns to idle", () => {
  const state = run(
    { type: "SELECT_SHAPES", ids: ["geo_1"] },
    { type: "START_DRAWING", tool: "area" },
    { type: "ADD_DRAFT_VERTEX", point: [1, 1] },
    { type: "CANCEL" },
  );
  assert.equal(state.gesture.kind, "idle");
  // Cancelling a gesture is not cancelling a selection: the inspector is still
  // showing the shape the user had picked.
  assert.deepEqual(selectionOf(state, "shapes").ids, ["geo_1"]);
  assert.equal(isDirty(state), false);
});

test("START_PAN cancels any active drawing gesture", () => {
  const panned = run(
    { type: "START_DRAWING", tool: "linear" },
    { type: "ADD_DRAFT_VERTEX", point: [0, 0] },
    { type: "ADD_DRAFT_VERTEX", point: [4, 0] },
    { type: "START_PAN" },
  );
  assert.equal(panned.gesture.kind, "panning");
  assert.equal(isDrawing(panned), false);
  assert.equal(canFinish(panned), false);
  // Panning twice is the same pan.
  assert.equal(editorReducer(panned, { type: "START_PAN" }), panned);
});

test("the rubber band tracks its far corner and ignores strays", () => {
  const started = run({ type: "START_RUBBER_BAND", start: [2, 3] });
  const box = gestureOf(started, "selecting");
  assert.deepEqual(box.boxStart, [2, 3]);
  assert.deepEqual(box.boxEnd, [2, 3], "an unmoved band is a zero-size box, not null");

  const dragged = editorReducer(started, { type: "UPDATE_RUBBER_BAND", end: [40, 50] });
  assert.deepEqual(gestureOf(dragged, "selecting").boxEnd, [40, 50]);
  assert.deepEqual(gestureOf(dragged, "selecting").boxStart, [2, 3]);
  // No band in flight: a move event changes nothing.
  assert.equal(editorReducer(INITIAL_EDITOR_STATE, { type: "UPDATE_RUBBER_BAND", end: [9, 9] }), INITIAL_EDITOR_STATE);
});

// ── selection ────────────────────────────────────────────────────────────────

test("SELECT_SHAPES adds only when asked, and never selects nothing", () => {
  const first = run({ type: "SELECT_SHAPES", ids: ["a", "b"] });
  assert.deepEqual(selectionOf(first, "shapes").ids, ["a", "b"]);

  const replaced = editorReducer(first, { type: "SELECT_SHAPES", ids: ["c"] });
  assert.deepEqual(selectionOf(replaced, "shapes").ids, ["c"]);

  const added = editorReducer(first, { type: "SELECT_SHAPES", ids: ["b", "c"], additive: true });
  assert.deepEqual(selectionOf(added, "shapes").ids, ["a", "b", "c"], "already-picked ids are not duplicated");

  const emptied = editorReducer(first, { type: "SELECT_SHAPES", ids: [] });
  assert.equal(emptied.selection.kind, "none", "an empty shape selection collapses to none");
  assert.deepEqual(selectedGeometryIds(emptied.selection), []);
});

test("a vertex edit selects the handle it grabbed", () => {
  const state = run({ type: "START_VERTEX_EDIT", geometryId: "geo_9", vertexIndex: 2 });
  const gesture = gestureOf(state, "editing-vertex");
  assert.equal(gesture.geometryId, "geo_9");
  assert.equal(gesture.vertexIndex, 2);
  const selection = selectionOf(state, "vertex");
  assert.equal(selection.geometryId, "geo_9");
  assert.equal(selection.index, 2);
  assert.deepEqual(selectedGeometryIds(state.selection), ["geo_9"]);

  // A drag with no handle grabbed moves nothing at all.
  assert.equal(editorReducer(INITIAL_EDITOR_STATE, { type: "MOVE_VERTEX", delta: [1, 1] }), INITIAL_EDITOR_STATE);
  assert.equal(editorReducer(state, { type: "MOVE_VERTEX", delta: [1, 1] }), state);
});

test("a segment selection names the span, not the points", () => {
  const state = run({ type: "SELECT_SEGMENT", geometryId: "geo_3", segmentIndex: 4 });
  assert.equal(selectionOf(state, "segment").segmentIndex, 4);
  assert.deepEqual(selectedGeometryIds(state.selection), ["geo_3"]);
  const cleared = editorReducer(state, { type: "CLEAR_SELECTION" });
  assert.equal(cleared.selection.kind, "none");
  assert.equal(editorReducer(cleared, { type: "CLEAR_SELECTION" }), cleared);
});

test("a shape can only be dragged once it is selected", () => {
  assert.equal(editorReducer(INITIAL_EDITOR_STATE, { type: "START_MOVE", offset: [1, 1] }), INITIAL_EDITOR_STATE);

  const moving = run({ type: "SELECT_SHAPES", ids: ["geo_1", "geo_2"] }, { type: "START_MOVE", offset: [0, 0] });
  assert.deepEqual(gestureOf(moving, "moving").geometryIds, ["geo_1", "geo_2"]);

  const dragged = editorReducer(moving, { type: "UPDATE_MOVE", offset: [12, -4] });
  assert.deepEqual(gestureOf(dragged, "moving").offset, [12, -4]);
  assert.equal(editorReducer(dragged, { type: "UPDATE_MOVE", offset: [12, -4] }), dragged, "same offset, same state");
});

// ── failed saves ─────────────────────────────────────────────────────────────

test("SAVE_FAILED records error and keeps gesture", () => {
  const idleFailure = editorReducer(INITIAL_EDITOR_STATE, {
    type: "SAVE_FAILED",
    error: "Network request failed",
    pendingOp: { op: "move", geometryId: "geo_1" },
  });
  const failed = gestureOf(idleFailure, "save-failed");
  assert.equal(failed.lastError, "Network request failed");
  assert.deepEqual(failed.pendingOp, { op: "move", geometryId: "geo_1" });
  assert.equal(saveError(idleFailure), "Network request failed");

  // A background failure must never cost the user the shape they are drawing.
  const drawing = run(
    { type: "SELECT_SHAPES", ids: ["geo_7"] },
    { type: "START_DRAWING", tool: "area" },
    { type: "ADD_DRAFT_VERTEX", point: [0, 0] },
    { type: "ADD_DRAFT_VERTEX", point: [8, 0] },
  );
  const stillDrawing = editorReducer(drawing, { type: "SAVE_FAILED", error: "500", pendingOp: null });
  assert.equal(stillDrawing.gesture.kind, "drawing");
  assert.equal(gestureOf(stillDrawing, "drawing").draftVertices.length, 2);
  assert.deepEqual(selectionOf(stillDrawing, "shapes").ids, ["geo_7"], "the selection is untouched too");
  assert.equal(canFinish(stillDrawing), true);
});

test("SAVE_SUCCEEDED clears save-failed state", () => {
  const failed = editorReducer(INITIAL_EDITOR_STATE, { type: "SAVE_FAILED", error: "timeout", pendingOp: null });
  const recovered = editorReducer(failed, { type: "SAVE_SUCCEEDED" });
  assert.equal(recovered.gesture.kind, "idle");
  assert.equal(saveError(recovered), null);

  // A success that lands mid-gesture must not interrupt it.
  const drawing = run({ type: "START_DRAWING", tool: "count" });
  assert.equal(editorReducer(drawing, { type: "SAVE_SUCCEEDED" }), drawing);
});

// ── guards and history ───────────────────────────────────────────────────────

test("canFinish is false until 2+ vertices", () => {
  assert.equal(canFinish(INITIAL_EDITOR_STATE), false);
  const empty = run({ type: "START_DRAWING", tool: "area" });
  assert.equal(canFinish(empty), false);
  const one = editorReducer(empty, { type: "ADD_DRAFT_VERTEX", point: [0, 0] });
  assert.equal(canFinish(one), false);
  const two = editorReducer(one, { type: "ADD_DRAFT_VERTEX", point: [10, 0] });
  assert.equal(canFinish(two), true);
  assert.equal(canFinish(editorReducer(two, { type: "REMOVE_LAST_DRAFT_VERTEX" })), false);
});

test("isDirty is true during drawing and editing", () => {
  assert.equal(isDirty(INITIAL_EDITOR_STATE), false);
  // A tool in hand with nothing placed yet has nothing to lose.
  assert.equal(isDirty(run({ type: "START_DRAWING", tool: "area" })), false);
  assert.equal(isDirty(run({ type: "START_DRAWING", tool: "area" }, { type: "ADD_DRAFT_VERTEX", point: [1, 1] })), true);
  assert.equal(isDirty(run({ type: "START_VERTEX_EDIT", geometryId: "geo_1", vertexIndex: 0 })), true);
  assert.equal(isDirty(run({ type: "SELECT_SHAPES", ids: ["geo_1"] }, { type: "START_MOVE", offset: [0, 0] })), true);
  assert.equal(isDirty(run({ type: "SAVE_FAILED", error: "500", pendingOp: null })), true, "a failed save is unsaved work");
  // Navigating and picking are not edits.
  assert.equal(isDirty(run({ type: "START_PAN" })), false);
  assert.equal(isDirty(run({ type: "START_RUBBER_BAND", start: [0, 0] })), false);
});

test("BUMP_HISTORY is the only thing that advances the history head", () => {
  const drawn = run(
    { type: "START_DRAWING", tool: "length" },
    { type: "ADD_DRAFT_VERTEX", point: [0, 0] },
    { type: "ADD_DRAFT_VERTEX", point: [10, 0] },
    { type: "FINISH_DRAWING" },
  );
  assert.equal(drawn.historyHead, 0);
  const committed = editorReducer(drawn, { type: "BUMP_HISTORY" });
  assert.equal(committed.historyHead, 1);
  assert.equal(editorReducer(committed, { type: "BUMP_HISTORY" }).historyHead, 2);
  assert.equal(committed.gesture.kind, "idle", "committing does not change the mode");
});

// ── the logical segment model ───────────────────────────────────────────────

test("segments are derived from vertices, with the wrap-around only on a real polygon", () => {
  const triangle = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];
  assert.equal(segmentCount(triangle.length), 2, "an open path of n points has n-1 spans");
  assert.equal(segmentCount(triangle.length, true), 3, "closing it adds the wrap-around");
  assert.equal(segmentCount(2, true), 1, "two points closed would count the same span twice");
  assert.equal(segmentCount(1), 0);
  assert.equal(segmentCount(0, true), 0);

  const open = segmentsOf("geo_1", triangle);
  assert.equal(open.length, 2);
  assert.deepEqual(
    open.map((s) => s.closing),
    [false, false],
  );

  const closed = segmentsOf("geo_1", triangle, true);
  assert.equal(closed.length, 3);
  const last = closed[2];
  assert.ok(last, "the closing span exists");
  assert.equal(last.closing, true);
  assert.deepEqual(last.start, [10, 10]);
  assert.deepEqual(last.end, [0, 0]);
  assert.deepEqual(vertexPairOfSegment(2, 3, true), [2, 0]);
  assert.equal(vertexPairOfSegment(2, 3, false), null, "out of range on an open path");
  assert.equal(segmentAt("geo_1", triangle, 5), null);
  assert.equal(segmentAt("geo_1", [[0, 0]], 0), null, "a single point is no segment");
});

test("a segment measures and labels itself in sheet points", () => {
  const segment = segmentAt("geo_1", [
    [0, 0],
    [30, 40],
  ], 0);
  assert.ok(segment, "the span exists");
  assert.equal(segmentLengthPt(segment), 50);
  assert.deepEqual(segmentMidpoint(segment), [15, 20]);
  assert.equal(segment.index, 0);
  assert.equal(segment.geometryId, "geo_1");
});

test("splitting a segment inserts the point between its ends", () => {
  const line = [
    [0, 0],
    [10, 0],
  ];
  assert.deepEqual(splitSegment(line, 0, [5, 0]), [
    [0, 0],
    [5, 0],
    [10, 0],
  ]);
  // A stray click on a segment that does not exist cannot corrupt the shape.
  assert.deepEqual(splitSegment(line, 7, [5, 0]), line);
  assert.deepEqual(line, [
    [0, 0],
    [10, 0],
  ], "the input is never mutated");
});

// ── helpers ─────────────────────────────────────────────────────────────────

function run(...actions: EditorAction[]): EditorState {
  return actions.reduce((state, action) => editorReducer(state, action), INITIAL_EDITOR_STATE);
}

function gestureOf<K extends EditorGesture["kind"]>(state: EditorState, kind: K): Extract<EditorGesture, { kind: K }> {
  const { gesture } = state;
  if (gesture.kind !== kind) throw new Error(`expected gesture "${kind}", got "${gesture.kind}"`);
  return gesture as Extract<EditorGesture, { kind: K }>;
}

function selectionOf<K extends EditorSelection["kind"]>(
  state: EditorState,
  kind: K,
): Extract<EditorSelection, { kind: K }> {
  const { selection } = state;
  if (selection.kind !== kind) throw new Error(`expected selection "${kind}", got "${selection.kind}"`);
  return selection as Extract<EditorSelection, { kind: K }>;
}
