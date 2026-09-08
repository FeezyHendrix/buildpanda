import { BadRequestError } from "../../../lib/errors.ts";
import type { GeometryKind, ManualQuantity, MeasureFactor, MeasureTool } from "./types.ts";

// Quantity maths for lines drawn by hand. Vertices are sheet points; the
// sheet's mm-per-point scale turns them into metres. Every figure is rounded
// to 2 dp, and the basis sentence names every factor that reached the number.

const round2 = (v: number): number => Math.round(v * 100) / 100;

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
 * every factor in the order applied.
 */
export function manualBasis(
  tool: MeasureTool,
  q: ManualQuantity,
  source: string,
  factor: MeasureFactor | undefined,
  typical: number,
  unit: string,
): string {
  const parts = [`${q.base} ${q.baseUnit} ${TOOL_WORD[tool]} ${source}`];
  if (tool === "wall_area") parts.push(`× ${factor?.heightM} m height`);
  if (tool === "volume") parts.push(`× ${factor?.depthM} m depth`);
  if (typical > 1) parts.push(`× ${typical} typical floors`);
  const total = applyTypical(q.gross, typical);
  return parts.length > 1 || total !== q.base ? `${parts.join(" ")} = ${total} ${unit}` : parts[0]!;
}
