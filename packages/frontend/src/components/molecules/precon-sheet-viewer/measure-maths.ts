import type { MeasureTool, PreconGeometryKind } from "@/api/precon";

// Pure sheet-point maths for the running total and the composer preview. It
// mirrors quantityFromVertices on the backend (pdf-takeoff/service.ts): points
// × mmPerPt / 1000 are metres; the server's figure is the one that is stored.

export const MEASURE_DEFAULT_UNIT: Record<MeasureTool, string> = {
  length: "m",
  polyline: "m",
  area: "m2",
  count: "nr",
  volume: "m3",
  wall_area: "m2",
};

export const MEASURE_MIN_VERTICES: Record<MeasureTool, number> = {
  length: 2,
  polyline: 2,
  area: 3,
  count: 1,
  volume: 3,
  wall_area: 2,
};

/** Length draws exactly two points and finishes itself. */
export const MEASURE_MAX_VERTICES: Partial<Record<MeasureTool, number>> = { length: 2 };

export const MEASURE_GEOMETRY_KIND: Record<MeasureTool, PreconGeometryKind> = {
  length: "linear",
  polyline: "linear",
  area: "area",
  count: "count",
  volume: "area",
  wall_area: "linear",
};

export interface MeasureFactor {
  heightM?: number;
  depthM?: number;
}

export interface QuantityPreview {
  /** Before typical ×N. */
  gross: number;
  /** gross × typical. */
  qty: number;
  unit: string;
  /** e.g. the perimeter of an area, shown as a secondary figure. */
  secondary: string | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Open path length in sheet points. */
export function pathLengthPt(vertices: number[][]): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    len += Math.hypot(vertices[i]![0]! - vertices[i - 1]![0]!, vertices[i]![1]! - vertices[i - 1]![1]!);
  }
  return len;
}

/** Closed polygon area in sheet points² (shoelace, always positive). */
export function polygonAreaPt2(vertices: number[][]): number {
  if (vertices.length < 3) return 0;
  let doubled = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    doubled += x1! * y2! - x2! * y1!;
  }
  return Math.abs(doubled / 2);
}

/** Closed polygon perimeter in sheet points. */
export function perimeterPt(vertices: number[][]): number {
  if (vertices.length < 2) return 0;
  return pathLengthPt([...vertices, vertices[0]!]);
}

/** Display form of a stored unit: m2 → m², m3 → m³. */
export function unitLabel(unit: string): string {
  return unit === "m2" ? "m²" : unit === "m3" ? "m³" : unit;
}

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * The quantity the backend will store for these vertices, or null when the
 * draft is too short or a needed factor is missing. Rounded to 2 dp like the
 * server so the preview and the stored line agree.
 */
export function previewQuantity(
  tool: MeasureTool,
  vertices: number[][],
  mmPerPt: number,
  factor: MeasureFactor = {},
  typical = 1,
): QuantityPreview | null {
  if (vertices.length < MEASURE_MIN_VERTICES[tool] || !(mmPerPt > 0)) return null;
  const toM = mmPerPt / 1000;
  const unit = MEASURE_DEFAULT_UNIT[tool];
  const n = Math.max(1, Number.isFinite(typical) ? typical : 1);
  const build = (gross: number, secondary: string | null = null): QuantityPreview => ({
    gross: round2(gross),
    qty: round2(round2(gross) * n),
    unit,
    secondary,
  });
  switch (tool) {
    case "count":
      return build(vertices.length);
    case "length":
    case "polyline":
      return build(pathLengthPt(vertices) * toM);
    case "area":
      return build(polygonAreaPt2(vertices) * toM * toM, `perimeter ${formatQty(round2(perimeterPt(vertices) * toM))} m`);
    case "volume": {
      if (!(factor.depthM && factor.depthM > 0)) return null;
      const areaM2 = round2(polygonAreaPt2(vertices) * toM * toM);
      return build(areaM2 * factor.depthM, `${formatQty(areaM2)} m² × ${formatQty(factor.depthM)} m deep`);
    }
    case "wall_area": {
      if (!(factor.heightM && factor.heightM > 0)) return null;
      const lengthM = round2(pathLengthPt(vertices) * toM);
      return build(lengthM * factor.heightM, `${formatQty(lengthM)} m × ${formatQty(factor.heightM)} m high`);
    }
  }
}

/**
 * The status-bar figure while drawing: what has been measured so far, in the
 * tool's own unit, before any height, depth or typical factor is known.
 */
export function runningTotal(tool: MeasureTool, vertices: number[][], mmPerPt: number): string | null {
  if (vertices.length === 0 || !(mmPerPt > 0)) return null;
  const toM = mmPerPt / 1000;
  switch (tool) {
    case "count":
      return `${vertices.length} pin${vertices.length === 1 ? "" : "s"} so far`;
    case "length":
    case "polyline":
    case "wall_area":
      return `${formatQty(round2(pathLengthPt(vertices) * toM))} m so far`;
    case "area":
    case "volume": {
      if (vertices.length < 3) return `${formatQty(round2(pathLengthPt(vertices) * toM))} m so far`;
      const area = formatQty(round2(polygonAreaPt2(vertices) * toM * toM));
      const perimeter = formatQty(round2(perimeterPt(vertices) * toM));
      return `${area} m² so far · perimeter ${perimeter} m`;
    }
  }
}
