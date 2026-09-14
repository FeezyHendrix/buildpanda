import { useRef, useState } from "react";
import { DRAG_THRESHOLD_PX, EMPTY_DRAFT, addDraftPoint, draftFromVertices, type DraftState } from "./draft-maths";

/**
 * The shape being drawn: clicked points, Alt-click arcs densified as they
 * close, and ready-made shapes (a dragged rectangle, a found room) dropped in
 * whole. Vertices are sheet points, the space the backend stores.
 */
export function useDraft() {
  const [state, setState] = useState<DraftState>(EMPTY_DRAFT);

  /** One click; returns the new state so the caller can finish a length on its second anchor. */
  const addPoint = (pt: number[], alt: boolean): DraftState => {
    const next = addDraftPoint(state, pt, alt);
    setState(next);
    return next;
  };
  const replace = (vertices: number[][]) => setState(draftFromVertices(vertices));
  const clear = () => setState(EMPTY_DRAFT);

  return { draft: state.vertices, anchors: state.anchors, arcMid: state.arcMid, addPoint, replace, clear };
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
