// The logical shape: what a command declares, what the server stores, and what
// every later read measures.
//
// Before this, a command could only send `vertices`. A bay window drawn as an
// arc therefore arrived as a densified polyline: the midpoint that DEFINES the
// curve was gone, and the chord sum it left behind under-measures a quarter
// circle by 4.7 % and a half one by 36 %. The analytic engine to do it properly
// (`measurement-arcs.ts`) had existed since task 3 and no writer could reach it.
//
// So the shape is authoritative and the renderer's vertices are DERIVED from
// it. Three rules make that unambiguous:
//
//   * a command sending only `vertices` means a straight path, exactly as it
//     always did — the shipped contract does not change under anyone;
//   * a command sending a `shape` gets the vertices the server derives, never
//     ones it supplied;
//   * a command sending BOTH is refused unless they already agree. Two
//     different declarations of one outline is not something to resolve by
//     picking a winner.
//
// Quantities are never accepted from a client here or anywhere: a shape is
// geometry, and the figure is measured from it.

import { BadRequestError } from "../../../lib/errors.ts";
import type { MeasurementShape, PathSegment } from "./editor-types.ts";
import { tessellateArc } from "./measurement-arcs.ts";
import {
  arcPolygonAreaM2,
  arcPolylineLengthM,
  assertMeasurable,
  GEOMETRY_KIND_BY_TOOL,
  round2,
  type ArcMids,
} from "./measurements.ts";
import type { ManualQuantity, MeasureFactor, MeasureTool } from "./types.ts";

/** Contract 16: 0.25 screen-px sagitta at zoom 1, capped at 5000 output vertices. */
const SAGITTA_PX = 0.25;
const MAX_VERTICES = 5000;

const POINT_TOOLS: readonly string[] = ["count"];
const CLOSED_TOOLS: readonly string[] = ["area", "volume", "room_fill"];

const finite = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  typeof value[1] === "number" &&
  Number.isFinite(value[0]) &&
  Number.isFinite(value[1]);

const point = (value: unknown, what: string): [number, number] => {
  if (!finite(value)) throw new BadRequestError(`${what} needs a finite x and y in sheet points`);
  return [value[0], value[1]];
};

const same = (a: [number, number], b: [number, number]): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * The shape a `vertices`-only command means: a straight path, or a set of
 * marks for a count. This is the shipped behaviour, written down.
 */
export function shapeFromVertices(tool: MeasureTool, vertices: number[][]): MeasurementShape {
  if (POINT_TOOLS.includes(tool)) {
    return { role: "points", points: vertices.map((v) => point(v, "Every mark")) };
  }
  const [start, ...rest] = vertices;
  return {
    role: "path",
    start: point(start ?? [0, 0], "The first point"),
    segments: rest.map((v) => ({ kind: "line", end: point(v, "Every point") })),
    closed: CLOSED_TOOLS.includes(tool),
  };
}

function validateSegments(tool: MeasureTool, start: [number, number], segments: unknown): PathSegment[] {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new BadRequestError(`A ${tool.replace("_", " ")} shape needs at least one segment`);
  }
  if (segments.length > MAX_VERTICES) throw new BadRequestError("That shape has too many segments to measure");
  let from = start;
  return segments.map((raw, index) => {
    if (typeof raw !== "object" || raw === null) throw new BadRequestError(`Segment ${index + 1} is not a segment`);
    const { kind, end, mid } = raw as { kind?: unknown; end?: unknown; mid?: unknown };
    const to = point(end, `Segment ${index + 1}'s end`);
    // A side of no length measures zero and looks drawn, which is the one
    // outcome worse than a refusal.
    if (same(from, to)) throw new BadRequestError(`Segment ${index + 1} has no length`);
    from = to;
    if (kind === "line") return { kind: "line", end: to };
    if (kind === "arc") return { kind: "arc", mid: point(mid, `Segment ${index + 1}'s midpoint`), end: to };
    throw new BadRequestError(`Segment ${index + 1} must be a line or an arc`);
  });
}

/** The declared shape, validated. Never normalised into something plausible. */
export function validateShape(tool: MeasureTool, raw: unknown): MeasurementShape {
  if (typeof raw !== "object" || raw === null) throw new BadRequestError("A shape is an object");
  const shape = raw as { role?: unknown; start?: unknown; segments?: unknown; closed?: unknown; points?: unknown };
  if (POINT_TOOLS.includes(tool)) {
    if (shape.role !== "points" || !Array.isArray(shape.points) || shape.points.length === 0) {
      throw new BadRequestError("A count is a set of marks: send `{ role: \"points\", points: [[x, y], ...] }`");
    }
    return { role: "points", points: shape.points.map((p) => point(p, "Every mark")) };
  }
  if (shape.role !== "path") throw new BadRequestError("That tool measures a path: send `{ role: \"path\", ... }`");
  const start = point(shape.start, "The path's start");
  const segments = validateSegments(tool, start, shape.segments);
  const closed = CLOSED_TOOLS.includes(tool) ? true : shape.closed === true;
  return { role: "path", start, segments, closed };
}

export interface DerivedShape {
  /**
   * What the renderer draws and what exports read: the logical shape tessellated
   * by the SERVER (contract 2 keeps `vertices` as the interoperable
   * representation). Never measured from — see `logical`.
   */
  vertices: number[][];
  /**
   * The outline's own corners: the start plus each segment's end. This is what
   * the analytic engine measures, because a side that curves must be measured
   * ONCE as a curve, not as the sum of the chords it was drawn with.
   */
  logical: number[][];
  /** Which logical sides curve, keyed by the logical vertex each starts at. */
  arcMids: ArcMids;
}

/**
 * The two representations of one outline, derived together.
 *
 * They are deliberately different arrays for different jobs: `logical` has one
 * point per corner so `arcMids` can name a curved SIDE, and `vertices` is as
 * fine as the eye needs. Keying arcs against the tessellation instead would
 * make every sub-chord its own side and reintroduce the chord error this whole
 * module exists to remove.
 */
export function deriveShape(shape: MeasurementShape): DerivedShape {
  if (shape.role === "points") {
    const points = shape.points.map((p) => [...p]);
    return { vertices: points, logical: points.map((p) => [...p]), arcMids: new Map() };
  }

  const vertices: number[][] = [[...shape.start]];
  const logical: number[][] = [[...shape.start]];
  const arcMids: ArcMids = new Map();
  let from: [number, number] = shape.start;
  for (const segment of shape.segments) {
    if (segment.kind === "arc") {
      arcMids.set(logical.length - 1, [...segment.mid]);
      const curve = tessellateArc({ start: from, mid: segment.mid, end: segment.end }, SAGITTA_PX, 1);
      for (const p of curve.slice(1)) vertices.push([...p]);
    } else {
      vertices.push([...segment.end]);
    }
    logical.push([...segment.end]);
    from = segment.end;
  }
  if (vertices.length > MAX_VERTICES) throw new BadRequestError("That shape needs too many points to draw");
  return { vertices, logical, arcMids };
}

/**
 * The figure a logical shape is worth, measured analytically. An arc
 * contributes its true length and its circular segment's area, so reading the
 * same shape back a year later returns the same number it was billed at.
 */
export function measureShape(
  tool: MeasureTool,
  shape: MeasurementShape,
  mmPerPt: number,
  factor: MeasureFactor = {},
): ManualQuantity {
  const { logical, arcMids } = deriveShape(shape);
  assertMeasurable(tool, logical, factor);
  const geometryKind = GEOMETRY_KIND_BY_TOOL[tool];
  switch (tool) {
    case "count":
      return { base: logical.length, baseUnit: "nr", gross: logical.length, unit: "nr", geometryKind };
    case "length":
    case "polyline": {
      const base = round2(arcPolylineLengthM(logical, arcMids, mmPerPt));
      return { base, baseUnit: "m", gross: base, unit: "m", geometryKind };
    }
    case "wall_area": {
      const base = round2(arcPolylineLengthM(logical, arcMids, mmPerPt));
      return { base, baseUnit: "m", gross: round2(base * factor.heightM!), unit: "m2", geometryKind };
    }
    case "area": {
      const base = round2(arcPolygonAreaM2(logical, arcMids, mmPerPt));
      return { base, baseUnit: "m2", gross: base, unit: "m2", geometryKind };
    }
    case "volume": {
      const base = round2(arcPolygonAreaM2(logical, arcMids, mmPerPt));
      return { base, baseUnit: "m2", gross: round2(base * factor.depthM!), unit: "m3", geometryKind };
    }
  }
}

/** The shape a stored definition records, when it records a usable one. */
export function storedShape(definition: unknown): MeasurementShape | null {
  if (typeof definition !== "object" || definition === null) return null;
  const shape = (definition as { shape?: unknown }).shape;
  if (typeof shape !== "object" || shape === null) return null;
  const role = (shape as { role?: unknown }).role;
  if (role === "points") {
    const points = (shape as { points?: unknown }).points;
    return Array.isArray(points) && points.every(finite) ? { role: "points", points: points.map((p) => [p[0], p[1]]) } : null;
  }
  if (role !== "path") return null;
  const { start, segments, closed } = shape as { start?: unknown; segments?: unknown; closed?: unknown };
  if (!finite(start) || !Array.isArray(segments) || segments.length === 0) return null;
  const parsed: PathSegment[] = [];
  for (const raw of segments) {
    const { kind, end, mid } = (raw ?? {}) as { kind?: unknown; end?: unknown; mid?: unknown };
    if (!finite(end)) return null;
    if (kind === "arc") {
      if (!finite(mid)) return null;
      parsed.push({ kind: "arc", mid: [mid[0], mid[1]], end: [end[0], end[1]] });
    } else if (kind === "line") {
      parsed.push({ kind: "line", end: [end[0], end[1]] });
    } else return null;
  }
  return { role: "path", start: [start[0], start[1]], segments: parsed, closed: closed === true };
}

/** True when a stored shape actually curves — the only case worth re-measuring analytically. */
export function hasArc(shape: MeasurementShape | null): boolean {
  return shape !== null && shape.role === "path" && shape.segments.some((segment) => segment.kind === "arc");
}

export interface ShapeRequest {
  tool: MeasureTool;
  shape?: unknown;
  vertices?: number[][];
}

/**
 * What one create-or-update actually means, from whichever of the two the
 * caller sent. Both, disagreeing, is refused: it is the one case where
 * choosing either would silently discard something a person declared.
 */
export function resolveShape(request: ShapeRequest): { shape: MeasurementShape; vertices: number[][] } {
  const { tool, shape: declared, vertices: sent } = request;
  if (declared === undefined || declared === null) {
    if (!Array.isArray(sent) || sent.length === 0) throw new BadRequestError("Send the shape, or the points to draw it from");
    const shape = shapeFromVertices(tool, sent);
    return { shape, vertices: deriveShape(shape).vertices };
  }
  const shape = validateShape(tool, declared);
  const derived = deriveShape(shape).vertices;
  if (Array.isArray(sent) && sent.length > 0) {
    const agrees =
      sent.length === derived.length &&
      sent.every((v, i) => finite(v) && v[0] === derived[i]![0] && v[1] === derived[i]![1]);
    if (!agrees) {
      throw new BadRequestError(
        "This edit sends both a shape and a different set of points, so it declares two outlines. " +
          "Send the shape on its own — the points to draw it are derived from it.",
      );
    }
  }
  return { shape, vertices: derived };
}
