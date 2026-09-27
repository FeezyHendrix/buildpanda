// Writing the shapes a restructure produces, and moving a shape without
// re-describing it.
//
// Two things every batch edit here has to keep, and both are invisible in the
// vertex list:
//
//   * the ARC controls. `measurementDefinition` rebuilds a shape's segments from
//     vertices alone, so every segment comes back straight — a bay window
//     silently loses its bulge. A transform or a paste is not a redraw, so those
//     paths map the stored definition's own points instead.
//   * the ASSEMBLY snapshot. A copied or moved line is still billed through the
//     factor the assembly had when it was drawn.

import { generateId } from "../../../lib/ids.ts";
import { assemblySnapshotOf, measurementDefinition } from "./measurement-definition.ts";
import { measureVertices } from "./measurements.ts";
import { mmPerPtOf } from "./viewports.ts";
import type {
  MeasureFactor,
  MeasureTool,
  PreconGeometryRow,
  PreconSheetRow,
  ScalePick,
} from "./types.ts";

export type PointMap = (point: [number, number]) => [number, number];

/**
 * Every control point of a stored definition through `move`, arcs included: the
 * path start, each segment end, each arc midpoint, each counted marker. Returns
 * null when there is no definition to map, so the caller falls back to rebuilding.
 */
export function mapDefinitionShape(definition: unknown, move: PointMap): unknown {
  if (typeof definition !== "object" || definition === null) return null;
  const source = definition as Record<string, unknown>;
  const shape = source["shape"] as Record<string, unknown> | undefined;
  if (!shape) return null;
  if (shape["role"] === "points" && Array.isArray(shape["points"])) {
    return { ...source, shape: { ...shape, points: (shape["points"] as [number, number][]).map(move) } };
  }
  if (shape["role"] === "path" && Array.isArray(shape["segments"])) {
    const segments = (shape["segments"] as Record<string, unknown>[]).map((segment) =>
      segment["kind"] === "arc"
        ? { ...segment, mid: move(segment["mid"] as [number, number]), end: move(segment["end"] as [number, number]) }
        : { ...segment, end: move(segment["end"] as [number, number]) },
    );
    return { ...source, shape: { ...shape, start: move(shape["start"] as [number, number]), segments } };
  }
  return null;
}

export const mapVertices = (vertices: number[][], move: PointMap): number[][] =>
  vertices.map((v) => move([v[0]!, v[1]!]));

/** Translate, then rotate about a point. Rotation is clockwise-positive in sheet space. */
export function rigidMotion(translate: [number, number], rotateDeg: number, about: [number, number]): PointMap {
  const radians = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return ([x, y]) => {
    const rx = x - about[0];
    const ry = y - about[1];
    return [about[0] + rx * cos - ry * sin + translate[0], about[1] + rx * sin + ry * cos + translate[1]];
  };
}

export interface ShapeWrite {
  vertices: number[][];
  definition: unknown;
  quantity: number;
  unit: string;
}

/**
 * One shape's row-ready figures. `mapped` carries the arcs through when the
 * caller is moving a shape; a genuine redraw passes null and the definition is
 * rebuilt from the new vertices.
 */
export function shapeWrite(
  tool: MeasureTool,
  vertices: number[][],
  factor: MeasureFactor,
  sheet: PreconSheetRow,
  pick: ScalePick | null,
  source: PreconGeometryRow | null,
  mapped: unknown,
): ShapeWrite {
  const measured = measureVertices(tool, vertices, mmPerPtOf(pick), factor);
  const rebuilt = measurementDefinition(tool, vertices, factor, sheet, pick, assemblySnapshotOf(source?.definition));
  return {
    vertices,
    definition: mapped ?? rebuilt,
    quantity: measured.base,
    unit: measured.baseUnit,
  };
}

export interface ReplaceShapesResult {
  keptId: string;
  createdIds: string[];
}

/**
 * Replace a line's single drawing with the N drawings a restructure produced.
 *
 * The FIRST piece keeps the original id. Everything that names that shape —
 * `row.deductions[].geometryId`, a child opening's `parent_geometry_id`, the
 * audit trail — keeps resolving, which is why a split does not orphan the
 * openings on the line it split.
 */
export async function replaceShapes(
  ctx: {
    geometries: {
      updateGeometryMeasurement(id: string, patch: Record<string, unknown>): PromiseLike<unknown>;
      insertGeometries(rows: Record<string, unknown>[]): PromiseLike<unknown>;
    };
  },
  original: PreconGeometryRow,
  rowId: string,
  sheetId: string,
  pieces: ShapeWrite[],
): Promise<ReplaceShapesResult> {
  const [first, ...rest] = pieces;
  await ctx.geometries.updateGeometryMeasurement(original.id, {
    vertices: first!.vertices,
    quantity: first!.quantity,
    unit: first!.unit,
    definition: first!.definition,
  });
  const createdIds: string[] = [];
  for (const piece of rest) {
    const id = generateId("pgeo");
    createdIds.push(id);
    await ctx.geometries.insertGeometries([
      {
        id,
        row_id: rowId,
        sheet_id: sheetId,
        kind: original.kind,
        vertices: piece.vertices,
        source: "manual",
        quantity: piece.quantity,
        unit: piece.unit,
        definition: piece.definition,
      },
    ]);
  }
  return { keptId: original.id, createdIds };
}
