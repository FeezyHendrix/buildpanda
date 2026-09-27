import { useRef, useState } from "react";
import { DRAG_THRESHOLD_PX, addDraftPoint, draftFromVertices, type DraftState } from "./draft-maths";
import { EMPTY_DRAFT_HISTORY, canRedoDraft, canUndoDraft, pushDraft, redoDraft, undoDraft } from "./draft-history";

export interface DraftApi {
  draft: number[][];
  anchors: number[][];
  arcMid: number[] | null;
  /** Logical sides so far; any `arc` entry means Finish sends a `shape`. */
  segments: import("@/api/precon-row-types").PathSegment[];
  canUndo: boolean;
  canRedo: boolean;
  addPoint: (pt: number[], alt: boolean) => DraftState;
  replace: (vertices: number[][]) => void;
  /** Backspace / Ctrl+Z: steps one logical gesture back (a whole arc, not one tessellation vertex). */
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * The shape being drawn: clicked points, Alt-click arcs densified as they
 * close, and ready-made shapes (a dragged rectangle, a found room) dropped in
 * whole. Vertices are sheet points, the space the backend stores. Every
 * gesture is one entry in a local undo/redo history that only Finish, Cancel
 * or a sheet change discards.
 */
export function useDraft(): DraftApi {
  const [history, setHistory] = useState(EMPTY_DRAFT_HISTORY);

  /** One click; returns the new state so the caller can finish a length on its second anchor. */
  const addPoint = (pt: number[], alt: boolean): DraftState => {
    const next = addDraftPoint(history.present, pt, alt);
    setHistory(pushDraft(history, next));
    return next;
  };
  const replace = (vertices: number[][]) => setHistory((h) => pushDraft(h, draftFromVertices(vertices)));
  const undo = () => setHistory(undoDraft);
  const redo = () => setHistory(redoDraft);
  const clear = () => setHistory(EMPTY_DRAFT_HISTORY);

  return {
    draft: history.present.vertices,
    anchors: history.present.anchors,
    arcMid: history.present.arcMid,
    segments: history.present.segments,
    canUndo: canUndoDraft(history),
    canRedo: canRedoDraft(history),
    addPoint,
    replace,
    undo,
    redo,
    clear,
  };
}

/** Two opposite corners in sheet points while the mouse is down and moving. */
export interface DragRect {
  start: [number, number];
  current: [number, number];
}

/**
 * Mousedown-drag-mouseup on the sheet, for the tools that take a box: Area
 * (a rectangle), Viewport and Find symbol. A press that moves less than the
 * threshold stays a click; a real drag swallows the click that follows it.
 */
export function useDragRect(screenToPt: (clientX: number, clientY: number) => [number, number] | null) {
  const [rect, setRect] = useState<DragRect | null>(null);
  const originRef = useRef<{ screen: [number, number]; pt: [number, number] } | null>(null);
  const suppressClickRef = useRef(false);

  const begin = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = screenToPt(e.clientX, e.clientY);
    if (pt) originRef.current = { screen: [e.clientX, e.clientY], pt };
  };
  const move = (e: React.MouseEvent) => {
    const origin = originRef.current;
    if (!origin) return;
    if (!rect && Math.hypot(e.clientX - origin.screen[0], e.clientY - origin.screen[1]) < DRAG_THRESHOLD_PX) return;
    const pt = screenToPt(e.clientX, e.clientY);
    if (pt) setRect({ start: origin.pt, current: pt });
  };
  /** Mouse up: the finished drag, or null when it was only a click. */
  const end = (): DragRect | null => {
    originRef.current = null;
    if (!rect) return null;
    setRect(null);
    suppressClickRef.current = true;
    return rect;
  };
  const cancel = () => {
    originRef.current = null;
    setRect(null);
  };
  /** True once for the click event a drag leaves behind. */
  const consumeClick = (): boolean => {
    const suppressed = suppressClickRef.current;
    suppressClickRef.current = false;
    return suppressed;
  };

  return { rect, begin, move, end, cancel, consumeClick };
}
