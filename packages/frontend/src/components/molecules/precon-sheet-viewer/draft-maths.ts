import type { SheetViewport } from "@/api/precon";

// Pure sheet-point geometry for the drawing tools: three-point arcs, the
// dragged rectangle and which viewport a draft falls in. No React here so the
// helpers can be unit-tested in node.

/** An arc is sent to the backend as this many straight segments. */
export const ARC_SEGMENTS = 16;
/** A mouse that moves less than this many screen pixels is a click, not a drag. */
export const DRAG_THRESHOLD_PX = 4;

const COLLINEAR_EPS = 1e-9;
const TWO_PI = Math.PI * 2;

/**
 * Points along the circular arc that starts at `a`, passes through `m` and
 * ends at `b`, both ends included (`segments + 1` points). Three collinear
 * points have no circle: the result is the straight line `[a, b]`.
 */
export function arcThroughPoints(a: number[], m: number[], b: number[], segments = ARC_SEGMENTS): number[][] {
  const [ax, ay] = [a[0]!, a[1]!];
  const [mx, my] = [m[0]!, m[1]!];
  const [bx, by] = [b[0]!, b[1]!];
  const d = 2 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my));
  if (Math.abs(d) < COLLINEAR_EPS) return [[ax, ay], [bx, by]];
  const a2 = ax * ax + ay * ay;
  const m2 = mx * mx + my * my;
  const b2 = bx * bx + by * by;
  const ux = (a2 * (my - by) + m2 * (by - ay) + b2 * (ay - my)) / d;
  const uy = (a2 * (bx - mx) + m2 * (ax - bx) + b2 * (mx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const start = Math.atan2(ay - uy, ax - ux);
  const ccw = (angle: number) => (((angle - start) % TWO_PI) + TWO_PI) % TWO_PI;
  const toMid = ccw(Math.atan2(my - uy, mx - ux));
  const toEnd = ccw(Math.atan2(by - uy, bx - ux));
  // the arc must pass through m: go anticlockwise if m is met before b that way, else clockwise
  const sweep = toMid < toEnd ? toEnd : toEnd - TWO_PI;
  const points: number[][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = start + (sweep * i) / segments;
    points.push([ux + r * Math.cos(t), uy + r * Math.sin(t)]);
  }
  points[0] = [ax, ay];
  points[segments] = [bx, by];
  return points;
}

/** Axis-aligned rectangle through two opposite corners, as four vertices in one turn. */
export function rectangleVertices(a: number[], b: number[]): number[][] {
  const [x1, y1, x2, y2] = rectOf(a, b);
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

/** `[minX, minY, maxX, maxY]` through two opposite corners. */
export function rectOf(a: number[], b: number[]): [number, number, number, number] {
  return [Math.min(a[0]!, b[0]!), Math.min(a[1]!, b[1]!), Math.max(a[0]!, b[0]!), Math.max(a[1]!, b[1]!)];
}

export function rectContains(rect: readonly number[], pt: readonly number[]): boolean {
  const [x1, y1, x2, y2] = rectOf([rect[0]!, rect[1]!], [rect[2]!, rect[3]!]);
  return pt[0]! >= x1 && pt[0]! <= x2 && pt[1]! >= y1 && pt[1]! <= y2;
}

/** The viewport whose rect contains the point — the backend measures a draft with the same rule (first vertex). */
export function viewportAt(viewports: readonly SheetViewport[] | null | undefined, pt: readonly number[] | undefined): SheetViewport | null {
  if (!viewports || !pt) return null;
  return viewports.find((viewport) => rectContains(viewport.rect, pt)) ?? null;
}

/** The scale a draft will be measured with: its viewport's, else the sheet's. */
export function scaleForDraft(sheetMmPerPt: number | null, viewports: readonly SheetViewport[] | null | undefined, draft: readonly number[][]): number | null {
  return viewportAt(viewports, draft[0])?.scaleMmPerPt ?? sheetMmPerPt;
}

/** What the drawing tools accumulate: the vertices to send, the clicked points to mark, a pending arc middle. */
export interface DraftState {
  vertices: number[][];
  /** The points the user actually clicked (an arc adds sixteen vertices for one click). */
  anchors: number[][];
  /** Alt-clicked: the next click closes an arc through this point. */
  arcMid: number[] | null;
}

export const EMPTY_DRAFT: DraftState = { vertices: [], anchors: [], arcMid: null };

/**
 * One click on the sheet. Alt-click with a point already down marks the arc's
 * middle; the next click then adds the arc from the last vertex through that
 * middle to the click, densified so the bill stores straight segments.
 */
export function addDraftPoint(state: DraftState, pt: number[], alt: boolean): DraftState {
  const last = state.vertices[state.vertices.length - 1];
  if (state.arcMid && last) {
    const arc = arcThroughPoints(last, state.arcMid, pt);
    return { vertices: [...state.vertices, ...arc.slice(1)], anchors: [...state.anchors, pt], arcMid: null };
  }
  if (alt && last) return { ...state, arcMid: pt };
  return { vertices: [...state.vertices, pt], anchors: [...state.anchors, pt], arcMid: null };
}

/** A ready-made shape (a rectangle, a found room) replaces whatever was being drawn. */
export function draftFromVertices(vertices: number[][]): DraftState {
  return { vertices, anchors: vertices, arcMid: null };
}
