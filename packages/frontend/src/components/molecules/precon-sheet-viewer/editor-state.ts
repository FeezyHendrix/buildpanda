/**
 * The take-off editor's mode, as a state machine.
 *
 * Two orthogonal discriminated unions: one **gesture** (what the pointer is
 * doing right now) and one **selection** (what the inspector is looking at),
 * plus a head index into the local draft history. Nothing else. The vertices
 * themselves stay in `use-draft.ts` and the saved geometry stays in the React
 * Query cache — this module owns only the *rules* about which mode may follow
 * which, so they can be read in one screen and tested without a browser.
 *
 * Pure TypeScript on purpose: no React, no `@/` alias, no imports at all, so
 * `editor-state.test.ts` runs under the plain node test runner alongside the
 * backend's take-off editor suite (`test:takeoff-editor`).
 *
 * Invariants the reducer holds:
 *  - Exactly one gesture is live; starting another implicitly cancels it.
 *  - `CANCEL` always lands on `idle` and never touches the selection.
 *  - Selection is never implied by a gesture ending: cancelling a drag leaves
 *    the shape selected, because that is what the inspector is still showing.
 *  - A failed save costs the user nothing that is in flight (see `SAVE_FAILED`).
 *  - A no-op returns the *same object*, so `useReducer` skips the re-render.
 *
 * A `segment` selection indexes the logical segment model in
 * `./segment-model.ts` — segments are derived from a shape's vertices, never
 * stored, so a selection can be resolved against whatever revision is loaded.
 */

/**
 * The palette tool key. Structurally `PreconTool` from `@/lib/precon-meta`
 * (a union of string literals, so it assigns straight in), widened to `string`
 * here to keep this module import-free and runnable outside the bundler.
 */
export type EditorToolKey = string;

/** Discriminated union of all possible editor modes. */
export type EditorGesture =
  | { kind: "idle" } // no active mode
  | { kind: "drawing"; tool: EditorToolKey; draftVertices: number[][] } // placing points
  | { kind: "selecting"; boxStart: [number, number]; boxEnd: [number, number] } // rubber-band
  | { kind: "moving"; geometryIds: string[]; offset: [number, number] } // dragging shape
  | { kind: "editing-vertex"; geometryId: string; vertexIndex: number } // moving one vertex
  | { kind: "panning" } // Space+drag
  | { kind: "save-failed"; lastError: string; pendingOp: unknown }; // after network error

/** What the user has selected. */
export type EditorSelection =
  | { kind: "none" }
  | { kind: "shapes"; ids: string[] }
  | { kind: "vertex"; geometryId: string; index: number }
  | { kind: "segment"; geometryId: string; segmentIndex: number };

export interface EditorState {
  gesture: EditorGesture;
  selection: EditorSelection;
  /** Index into the local draft history; bumped only once an op has landed. */
  historyHead: number;
}

const IDLE: EditorGesture = { kind: "idle" };
const NO_SELECTION: EditorSelection = { kind: "none" };

export const INITIAL_EDITOR_STATE: EditorState = {
  gesture: IDLE,
  selection: NO_SELECTION,
  historyHead: 0,
};

/** Discriminated union of all actions that can change editor state. */
export type EditorAction =
  | { type: "START_DRAWING"; tool: EditorToolKey }
  | { type: "ADD_DRAFT_VERTEX"; point: [number, number] }
  | { type: "REMOVE_LAST_DRAFT_VERTEX" }
  | { type: "FINISH_DRAWING" }
  | { type: "CANCEL" }
  | { type: "SELECT_SHAPES"; ids: string[]; additive?: boolean }
  | { type: "SELECT_VERTEX"; geometryId: string; index: number }
  | { type: "SELECT_SEGMENT"; geometryId: string; segmentIndex: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "START_VERTEX_EDIT"; geometryId: string; vertexIndex: number }
  | { type: "MOVE_VERTEX"; delta: [number, number] }
  | { type: "START_MOVE"; offset: [number, number] }
  | { type: "UPDATE_MOVE"; offset: [number, number] }
  | { type: "START_PAN" }
  | { type: "START_RUBBER_BAND"; start: [number, number] }
  | { type: "UPDATE_RUBBER_BAND"; end: [number, number] }
  | { type: "SAVE_FAILED"; error: string; pendingOp: unknown }
  | { type: "SAVE_SUCCEEDED" }
  | { type: "BUMP_HISTORY" };

/** Pure reducer — no side effects, no network, no database calls. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "START_DRAWING":
      // Picking up a tool abandons whatever gesture was live; the selection
      // stays, because the new shape is often measured against it.
      return { ...state, gesture: { kind: "drawing", tool: action.tool, draftVertices: [] } };

    case "ADD_DRAFT_VERTEX": {
      const { gesture } = state;
      if (gesture.kind !== "drawing") return state;
      const draftVertices = [...gesture.draftVertices, [action.point[0], action.point[1]]];
      return { ...state, gesture: { ...gesture, draftVertices } };
    }

    case "REMOVE_LAST_DRAFT_VERTEX": {
      const { gesture } = state;
      if (gesture.kind !== "drawing" || gesture.draftVertices.length === 0) return state;
      return { ...state, gesture: { ...gesture, draftVertices: gesture.draftVertices.slice(0, -1) } };
    }

    case "FINISH_DRAWING":
      // Back to idle only; the caller commits the shape and dispatches
      // BUMP_HISTORY once the write has landed, so a save that fails cannot
      // leave the history claiming work the backend never took.
      return canFinish(state) ? toIdle(state) : state;

    case "CANCEL":
      return toIdle(state);

    case "SELECT_SHAPES": {
      const base = action.additive && state.selection.kind === "shapes" ? state.selection.ids : [];
      const ids = [...base];
      for (const id of action.ids) if (!ids.includes(id)) ids.push(id);
      // A `shapes` selection with nothing in it is not a state worth having.
      return withSelection(state, ids.length > 0 ? { kind: "shapes", ids } : NO_SELECTION);
    }

    case "SELECT_VERTEX":
      return withSelection(state, { kind: "vertex", geometryId: action.geometryId, index: action.index });

    case "SELECT_SEGMENT":
      return withSelection(state, { kind: "segment", geometryId: action.geometryId, segmentIndex: action.segmentIndex });

    case "CLEAR_SELECTION":
      return withSelection(state, NO_SELECTION);

    case "START_VERTEX_EDIT":
      // Grabbing a handle both starts the drag and selects the vertex, so the
      // inspector shows the point being moved rather than the whole shape.
      return {
        ...state,
        gesture: { kind: "editing-vertex", geometryId: action.geometryId, vertexIndex: action.vertexIndex },
        selection: { kind: "vertex", geometryId: action.geometryId, index: action.vertexIndex },
      };

    case "MOVE_VERTEX": {
      const { gesture } = state;
      // A drag with no handle grabbed moves nothing — this guard is the point
      // of the action. `delta` is applied to the draft vertices by the caller;
      // the reducer only keeps the moved point as the live selection.
      if (gesture.kind !== "editing-vertex") return state;
      return withSelection(state, { kind: "vertex", geometryId: gesture.geometryId, index: gesture.vertexIndex });
    }

    case "START_MOVE": {
      // You can only drag what is selected.
      const geometryIds = selectedGeometryIds(state.selection);
      if (geometryIds.length === 0) return state;
      return { ...state, gesture: { kind: "moving", geometryIds, offset: action.offset } };
    }

    case "UPDATE_MOVE": {
      const { gesture } = state;
      if (gesture.kind !== "moving") return state;
      if (gesture.offset[0] === action.offset[0] && gesture.offset[1] === action.offset[1]) return state;
      return { ...state, gesture: { ...gesture, offset: action.offset } };
    }

    case "START_PAN":
      // Space+drag wins over a half-drawn shape: navigating is never blocked.
      return state.gesture.kind === "panning" ? state : { ...state, gesture: { kind: "panning" } };

    case "START_RUBBER_BAND":
      return { ...state, gesture: { kind: "selecting", boxStart: action.start, boxEnd: action.start } };

    case "UPDATE_RUBBER_BAND": {
      const { gesture } = state;
      if (gesture.kind !== "selecting") return state;
      return { ...state, gesture: { ...gesture, boxEnd: action.end } };
    }

    case "SAVE_FAILED":
      // A save failing in the background must not cost the user the shape they
      // are part-way through, so a live gesture outranks the failure — the
      // caller still surfaces it from the mutation's own error. The
      // `save-failed` gesture is the idle editor's recovery banner, holding the
      // op so it can be retried.
      if (isInteractive(state.gesture)) return state;
      return { ...state, gesture: { kind: "save-failed", lastError: action.error, pendingOp: action.pendingOp } };

    case "SAVE_SUCCEEDED":
      // Clears the banner and nothing else: a success arriving mid-gesture must
      // not interrupt the drawing it raced.
      return state.gesture.kind === "save-failed" ? toIdle(state) : state;

    case "BUMP_HISTORY":
      return { ...state, historyHead: state.historyHead + 1 };
  }
}

// ── guards ───────────────────────────────────────────────────────────────────

export function isDrawing(state: EditorState): boolean {
  return state.gesture.kind === "drawing";
}

/** True only while drawing a shape that already has a measurable span. */
export function canFinish(state: EditorState): boolean {
  return state.gesture.kind === "drawing" && state.gesture.draftVertices.length >= 2;
}

/**
 * Has unsaved work in progress — what a "discard changes?" prompt asks. A
 * tool picked up but not yet clicked is not dirty: there is nothing to lose.
 */
export function isDirty(state: EditorState): boolean {
  switch (state.gesture.kind) {
    case "drawing":
      return state.gesture.draftVertices.length > 0;
    case "moving":
    case "editing-vertex":
    case "save-failed":
      return true;
    case "idle":
    case "panning":
    case "selecting":
      return false;
  }
}

/** The geometries a selection covers, whatever shape the selection takes. */
export function selectedGeometryIds(selection: EditorSelection): string[] {
  switch (selection.kind) {
    case "shapes":
      return selection.ids;
    case "vertex":
    case "segment":
      return [selection.geometryId];
    case "none":
      return [];
  }
}

/** The tool being drawn with, or null when no shape is being placed. */
export function drawingTool(state: EditorState): EditorToolKey | null {
  return state.gesture.kind === "drawing" ? state.gesture.tool : null;
}

/** The error a failed save left behind, or null. */
export function saveError(state: EditorState): string | null {
  return state.gesture.kind === "save-failed" ? state.gesture.lastError : null;
}

// ── internals ────────────────────────────────────────────────────────────────

/** A gesture the user is actively performing, as opposed to idle or blocked. */
function isInteractive(gesture: EditorGesture): boolean {
  return gesture.kind !== "idle" && gesture.kind !== "save-failed";
}

function toIdle(state: EditorState): EditorState {
  return state.gesture.kind === "idle" ? state : { ...state, gesture: IDLE };
}

function withSelection(state: EditorState, selection: EditorSelection): EditorState {
  return sameSelection(state.selection, selection) ? state : { ...state, selection };
}

function sameSelection(a: EditorSelection, b: EditorSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "shapes" && b.kind === "shapes") {
    return a.ids.length === b.ids.length && a.ids.every((id, i) => id === b.ids[i]);
  }
  if (a.kind === "vertex" && b.kind === "vertex") return a.geometryId === b.geometryId && a.index === b.index;
  if (a.kind === "segment" && b.kind === "segment") {
    return a.geometryId === b.geometryId && a.segmentIndex === b.segmentIndex;
  }
  return true; // both "none"
}
