/**
 * The logical segment model for a take-off shape.
 *
 * A measured shape is stored as a list of vertices, but a surveyor reasons in
 * *segments* — the span between two consecutive points. A wall run is priced
 * per segment, a deduction sits on a segment, and "split this line here" means
 * "insert a vertex into segment n". Nothing on the wire changes: a segment is
 * derived from the vertex list, never stored, so it cannot drift from the
 * geometry the backend holds.
 *
 * Pure TypeScript on purpose — no React, no imports, no `@/` alias — so it can
 * be read, reasoned about and run by the plain node test runner alongside
 * `editor-state.ts`.
 *
 * Coordinates are sheet points, the space the backend stores (see
 * `use-draft.ts`).
 */

/** A point in sheet points. */
export type SheetPoint = [number, number];

/** One span between two consecutive vertices of a geometry. */
export interface LogicalSegment {
  geometryId: string;
  /** 0-based; segment `i` joins vertex `i` to vertex `i + 1`. */
  index: number;
  start: SheetPoint;
  end: SheetPoint;
  /** The wrap-around span of a closed shape: the last vertex back to the first. */
  closing: boolean;
}

/**
 * How many segments a shape has.
 *
 * An open path of n points has n-1 spans. A closed one adds the wrap-around,
 * but only once it is a real polygon: two points "closed" would count the same
 * span twice, so it stays a single open segment.
 */
export function segmentCount(vertexCount: number, closed = false): number {
  if (vertexCount < 2) return 0;
  return closed && vertexCount > 2 ? vertexCount : vertexCount - 1;
}

/** The two vertex indices segment `index` joins, or null when it is out of range. */
export function vertexPairOfSegment(index: number, vertexCount: number, closed = false): [number, number] | null {
  if (!Number.isInteger(index) || index < 0 || index >= segmentCount(vertexCount, closed)) return null;
  const next = index + 1 === vertexCount ? 0 : index + 1;
  return [index, next];
}

/** Every segment of a shape, in drawing order; `[]` for anything shorter than a line. */
export function segmentsOf(geometryId: string, vertices: readonly number[][], closed = false): LogicalSegment[] {
  const total = segmentCount(vertices.length, closed);
  const segments: LogicalSegment[] = [];
  for (let index = 0; index < total; index += 1) {
    const segment = segmentAt(geometryId, vertices, index, closed);
    if (segment) segments.push(segment);
  }
  return segments;
}

/** One segment by index, or null when the index or either endpoint is unusable. */
export function segmentAt(
  geometryId: string,
  vertices: readonly number[][],
  index: number,
  closed = false,
): LogicalSegment | null {
  const pair = vertexPairOfSegment(index, vertices.length, closed);
  if (!pair) return null;
  const start = toPoint(vertices[pair[0]]);
  const end = toPoint(vertices[pair[1]]);
  if (!start || !end) return null;
  return { geometryId, index, start, end, closing: pair[1] === 0 };
}

/** Straight-line length in sheet points; multiply by the sheet scale for millimetres. */
export function segmentLengthPt(segment: LogicalSegment): number {
  return Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]);
}

/** Where a segment's label, handle or deduction marker sits. */
export function segmentMidpoint(segment: LogicalSegment): SheetPoint {
  return [(segment.start[0] + segment.end[0]) / 2, (segment.start[1] + segment.end[1]) / 2];
}

/**
 * The vertex list after splitting segment `index` at `point` — the insert an
 * "add a vertex here" gesture applies. Returns the original list untouched
 * when the segment does not exist, so a stray click cannot corrupt a shape.
 */
export function splitSegment(vertices: readonly number[][], index: number, point: SheetPoint, closed = false): number[][] {
  const pair = vertexPairOfSegment(index, vertices.length, closed);
  const copy = vertices.map((vertex) => [...vertex]);
  if (!pair) return copy;
  copy.splice(pair[0] + 1, 0, [point[0], point[1]]);
  return copy;
}

/** A stored vertex (a bare `number[]`) as a point, or null when it is malformed. */
function toPoint(vertex: readonly number[] | undefined): SheetPoint | null {
  if (!vertex) return null;
  const [x, y] = vertex;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}
