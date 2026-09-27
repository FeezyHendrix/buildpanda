import { EMPTY_DRAFT, type DraftState } from "./draft-maths.ts";

// Logical undo/redo over the draft being drawn. Each entry is one *gesture* —
// a click, an Alt-click arc midpoint, a completed (densified) arc, a dropped-in
// rectangle — never one tessellation vertex, so undoing a 16-segment arc is a
// single step back to its recoverable midpoint. Pure data, no React, so
// `draft-history.test.ts` runs under the plain node test runner.

export interface DraftHistory {
  past: DraftState[];
  present: DraftState;
  future: DraftState[];
}

export const EMPTY_DRAFT_HISTORY: DraftHistory = { past: [], present: EMPTY_DRAFT, future: [] };

/** One logical gesture lands: the redo branch is abandoned. Identical state is a no-op. */
export function pushDraft(history: DraftHistory, next: DraftState): DraftHistory {
  if (next === history.present) return history;
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function undoDraft(history: DraftHistory): DraftHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoDraft(history: DraftHistory): DraftHistory {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export function canUndoDraft(history: DraftHistory): boolean {
  return history.past.length > 0;
}

export function canRedoDraft(history: DraftHistory): boolean {
  return history.future.length > 0;
}

/**
 * A double-click fires click–click–dblclick: the second click lands a point on
 * top of the previous one before the finish runs. Strip that repeated final
 * anchor so Finish never stores a duplicate vertex.
 */
export function withoutTrailingDuplicate(state: DraftState): DraftState {
  const { anchors, vertices } = state;
  const last = anchors[anchors.length - 1];
  const beforeLast = anchors[anchors.length - 2];
  if (!last || !beforeLast || !samePoint(last, beforeLast)) return state;
  const lastVertex = vertices[vertices.length - 1];
  const beforeLastVertex = vertices[vertices.length - 2];
  const dropVertex = lastVertex && beforeLastVertex && samePoint(lastVertex, beforeLastVertex);
  return {
    ...state,
    anchors: anchors.slice(0, -1),
    vertices: dropVertex ? vertices.slice(0, -1) : vertices,
    // the repeated click also minted a zero-length logical side
    segments: state.segments.slice(0, -1),
  };
}

function samePoint(a: readonly number[], b: readonly number[]): boolean {
  return Math.abs(a[0]! - b[0]!) < 1e-9 && Math.abs(a[1]! - b[1]!) < 1e-9;
}
