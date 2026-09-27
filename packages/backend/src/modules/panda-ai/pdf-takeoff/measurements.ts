import { BadRequestError } from "../../../lib/errors.ts";
import { arcLengthPt, arcSignedAreaPt, type ArcPoints } from "./measurement-arcs.ts";
import { basisFor } from "./measurement-basis.ts";
import { isSelfIntersecting } from "./measurement-topology.ts";
import type { GeometryKind, ManualQuantity, MeasureFactor, MeasureTool } from "./types.ts";

// Quantity maths for lines drawn by hand. Vertices are sheet points; the
// sheet's mm-per-point scale turns them into metres. Every figure is rounded
// to 2 dp, and the basis sentence names every factor that reached the number.

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export const DEFAULT_UNITS: Record<MeasureTool, string> = {
  length: "m",
  polyline: "m",
  area: "m2",
  count: "nr",
  volume: "m3",
  wall_area: "m2",
};

export const GEOMETRY_KIND_BY_TOOL: Record<MeasureTool, GeometryKind> = {
  length: "linear",
  polyline: "linear",
  area: "area",
  count: "count",
  volume: "area",
  wall_area: "linear",
};

const MIN_VERTICES: Record<MeasureTool, number> = {
  length: 2,
  polyline: 2,
  area: 3,
  count: 1,
  volume: 3,
  wall_area: 2,
};

export function polylineLengthM(vertices: number[][], mmPerPt: number): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    len += Math.hypot(vertices[i]![0]! - vertices[i - 1]![0]!, vertices[i]![1]! - vertices[i - 1]![1]!);
  }
  return (len * mmPerPt) / 1000;
}

// Shoelace over the closed polygon; the last vertex joins back to the first.
export function polygonAreaM2(vertices: number[][], mmPerPt: number): number {
  let doubled = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    doubled += x1! * y2! - x2! * y1!;
  }
  const toM = mmPerPt / 1000;
  return Math.abs(doubled / 2) * toM * toM;
}

// ---------- curved runs ----------
//
// `arcMids` keys a segment by the index of the vertex it starts at: an entry at
// 0 curves the run from vertices[0] to vertices[1] through the point given.
// Segments with no entry stay straight, so the arc-aware functions below return
// exactly what their straight-line siblings do when the map is empty.

export type ArcMids = Map<number, [number, number]>;

function arcAt(arcMids: ArcMids, index: number, from: number[], to: number[]): ArcPoints | null {
  const mid = arcMids.get(index);
  if (!mid) return null;
  return { start: [from[0]!, from[1]!], mid, end: [to[0]!, to[1]!] };
}

/** `polylineLengthM`, but a curved segment contributes its arc length, not its chord. */
export function arcPolylineLengthM(vertices: number[][], arcMids: ArcMids, mmPerPt: number): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    const from = vertices[i - 1]!;
    const to = vertices[i]!;
    const arc = arcAt(arcMids, i - 1, from, to);
    const curved = arc ? arcLengthPt(arc) : Number.NaN;
    // a collinear "arc" is a straight line; fall back to the chord rather than poison the total
    len += Number.isFinite(curved) ? curved : Math.hypot(to[0]! - from[0]!, to[1]! - from[1]!);
  }
  return (len * mmPerPt) / 1000;
}

/** `polygonAreaM2`, corrected by each curved side's circular segment so a bay window bills its bulge. */
export function arcPolygonAreaM2(vertices: number[][], arcMids: ArcMids, mmPerPt: number): number {
  let doubled = 0;
  let arcArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i]!;
    const to = vertices[(i + 1) % vertices.length]!;
    doubled += from[0]! * to[1]! - to[0]! * from[1]!;
    const arc = arcAt(arcMids, i, from, to);
    if (arc) arcArea += arcSignedAreaPt(arc);
  }
  const toM = mmPerPt / 1000;
  return Math.abs(doubled / 2 + arcArea) * toM * toM;
}

/** Rejects a drawing the tool cannot turn into a number, with the reason a person can act on. */
export function assertMeasurable(tool: MeasureTool, vertices: number[][], factor: MeasureFactor | undefined): void {
  if (vertices.length < MIN_VERTICES[tool]) {
    throw new BadRequestError(`A ${tool.replace("_", " ")} needs at least ${MIN_VERTICES[tool]} point${MIN_VERTICES[tool] > 1 ? "s" : ""}`);
  }
  if (vertices.some((v) => v.length < 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1]))) {
    throw new BadRequestError("Every vertex needs an x and a y");
  }
  if (tool === "wall_area" && !(factor?.heightM && factor.heightM > 0)) {
    throw new BadRequestError("Wall area needs a height in metres");
  }
  if (tool === "volume" && !(factor?.depthM && factor.depthM > 0)) {
    throw new BadRequestError("Volume needs a depth in metres");
  }
}

const POLYGON_TOOLS: readonly string[] = ["area", "volume", "room_fill"];

function toolWords(tool: MeasureTool): string {
  return tool.replace("_", " ");
}

/** Drops the closing repeat of the first point, so a closed outline is not read as a duplicate side. */
function withoutClosingPoint(vertices: number[][]): number[][] {
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  if (vertices.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) return vertices.slice(0, -1);
  return vertices;
}

/**
 * Everything `assertMeasurable` refuses, plus the two shapes that measure a
 * plausible number while meaning nothing: a side of zero length, and a polygon
 * that crosses itself (shoelace nets a bow-tie's lobes against each other, so
 * a mis-drawn slab returns a defensible-looking figure nobody can stand behind).
 */
export function validateGeometry(tool: MeasureTool, vertices: number[][], factor: MeasureFactor | undefined): void {
  assertMeasurable(tool, vertices, factor);
  // a count is marks on a sheet, not a path: two marks in one place is a tally, not a zero-length side
  const outline = tool === "count" ? [] : POLYGON_TOOLS.includes(tool) ? withoutClosingPoint(vertices) : vertices;
  for (let i = 1; i < outline.length; i++) {
    const from = outline[i - 1]!;
    const to = outline[i]!;
    if (from[0] === to[0] && from[1] === to[1]) {
      throw new BadRequestError(`A ${toolWords(tool)} cannot have duplicate adjacent points`);
    }
  }
  if (POLYGON_TOOLS.includes(tool) && isSelfIntersecting(vertices)) {
    throw new BadRequestError(`A ${toolWords(tool)} polygon cannot self-intersect`);
  }
}

export function measureVertices(tool: MeasureTool, vertices: number[][], mmPerPt: number, factor: MeasureFactor = {}): ManualQuantity {
  assertMeasurable(tool, vertices, factor);
  const geometryKind = GEOMETRY_KIND_BY_TOOL[tool];
  switch (tool) {
    case "count":
      return { base: vertices.length, baseUnit: "nr", gross: vertices.length, unit: "nr", geometryKind };
    case "length":
    case "polyline": {
      const base = round2(polylineLengthM(vertices, mmPerPt));
      return { base, baseUnit: "m", gross: base, unit: "m", geometryKind };
    }
    case "wall_area": {
      const base = round2(polylineLengthM(vertices, mmPerPt));
      return { base, baseUnit: "m", gross: round2(base * factor.heightM!), unit: "m2", geometryKind };
    }
    case "area": {
      const base = round2(polygonAreaM2(vertices, mmPerPt));
      return { base, baseUnit: "m2", gross: base, unit: "m2", geometryKind };
    }
    case "volume": {
      const base = round2(polygonAreaM2(vertices, mmPerPt));
      return { base, baseUnit: "m2", gross: round2(base * factor.depthM!), unit: "m3", geometryKind };
    }
  }
}

// A figure typed or spoken instead of drawn: the tool's factor still applies
// ("12 m of wall at 2.7 m high" is 32.4 m2), only the drawing is missing.
export function quantityFromStated(tool: MeasureTool, qty: number, factor: MeasureFactor = {}): ManualQuantity {
  if (!(Number.isFinite(qty) && qty > 0)) throw new BadRequestError("A stated quantity must be a positive number");
  const geometryKind = GEOMETRY_KIND_BY_TOOL[tool];
  const base = round2(qty);
  if (tool === "wall_area") {
    if (!(factor.heightM && factor.heightM > 0)) throw new BadRequestError("Wall area needs a height in metres");
    return { base, baseUnit: "m", gross: round2(base * factor.heightM), unit: "m2", geometryKind };
  }
  if (tool === "volume") {
    if (!(factor.depthM && factor.depthM > 0)) throw new BadRequestError("Volume needs a depth in metres");
    return { base, baseUnit: "m2", gross: round2(base * factor.depthM), unit: "m3", geometryKind };
  }
  const unit = DEFAULT_UNITS[tool];
  return { base, baseUnit: unit, gross: base, unit, geometryKind };
}

/** Typical ×N is a whole number of identical floors or areas; anything else is a mistake, not a factor. */
export function normaliseTypical(typical: number | undefined): number {
  if (typical === undefined) return 1;
  if (!Number.isInteger(typical) || typical < 1) throw new BadRequestError("Typical must be a whole number of 1 or more");
  return typical;
}

export function applyTypical(gross: number, typical: number): number {
  return round2(gross * typical);
}

const TOOL_WORD: Record<MeasureTool, string> = {
  length: "length",
  polyline: "polyline",
  area: "area",
  count: "count",
  volume: "area",
  wall_area: "polyline",
};

/**
 * "12.4 m polyline on DWG-01 × 2.7 m height × 4 typical floors = 133.92 m2":
 * the drawn figure, where it came from ("on DWG-01", "stated in prompt"), and
 * every factor in the order applied. Builds only the head — the clauses that
 * follow it belong to `basisFor`, which composes the whole sentence.
 */
export function manualBasis(
  tool: MeasureTool,
  q: ManualQuantity,
  source: string,
  factor: MeasureFactor | undefined,
  typical: number,
  unit: string,
): string {
  const head = [`${q.base} ${q.baseUnit} ${TOOL_WORD[tool]} ${source}`];
  if (tool === "wall_area") head.push(`× ${factor?.heightM} m height`);
  if (tool === "volume") head.push(`× ${factor?.depthM} m depth`);
  // A line being drawn carries no openings yet; they arrive through the deduction writers.
  return basisFor({
    basis: head.join(" "),
    gross: q.gross,
    deductions: [],
    typical,
    net: applyTypical(q.gross, typical),
    unit,
  })!;
}

// ---------- typical on an existing row ----------

/** net = (gross − Σdeductions) × typical, never below zero, 2 dp. */
export function netQuantity(gross: number, deductions: { qty: number }[], typical: number): number {
  const deducted = deductions.reduce((s, d) => s + d.qty, 0);
  return round2(Math.max(0, gross - deducted) * typical);
}


