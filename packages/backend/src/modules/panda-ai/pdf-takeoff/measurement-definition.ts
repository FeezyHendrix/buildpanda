// Writing the lossless record, so the next redraw does not have to guess.
//
// `resolveMeasureTool` reads a definition; this writes one. Every server-side
// re-measure stores the tool, the factor and the scale binding it used, which
// is what turns the legacy basis-sentence fallback into a one-time migration
// path rather than a permanent guess.

import { shapeFromVertices } from "./measurement-shape.ts";
import type {
  AssemblySnapshot,
  DeductionDefinitionV1,
  MeasurementDefinitionV1,
  MeasurementSettingsV1,
  MeasurementShape,
  ScaleBinding,
} from "./editor-types.ts";
import type { MeasureFactor, MeasureTool, PreconSheetRow, ScalePick } from "./types.ts";

const POINT_TOOLS: readonly string[] = ["count"];


function shapeFor(tool: MeasureTool, vertices: number[][]): MeasurementShape {
  return shapeFromVertices(tool, vertices);
}

/** Which scale produced the figure, and the sheet version it was true for. */
function scaleFor(sheet: PreconSheetRow, pick: ScalePick): ScaleBinding {
  const sheetVersion = sheet.version ?? 1;
  return pick.viewport
    ? { source: "viewport", viewportId: pick.viewport.id, sheetVersion, appliedMmPerPt: pick.mmPerPt }
    : { source: "sheet", sheetVersion, appliedMmPerPt: pick.mmPerPt };
}

/**
 * The assembly factor frozen into a shape's definition, or null when the line is
 * not an assembly output. Read rather than recomputed from the library: the rate
 * card may have been edited since, and this line was measured against the factor
 * as it stood (contract 4).
 */
export function assemblyFactorOf(definition: unknown): number | null {
  if (typeof definition !== "object" || definition === null) return null;
  const factor = (definition as { assembly?: { factor?: unknown } }).assembly?.factor;
  return typeof factor === "number" && Number.isFinite(factor) && factor > 0 ? factor : null;
}

/** The frozen assembly snapshot on a shape, for a rewrite that must preserve it. */
export function assemblySnapshotOf(definition: unknown): AssemblySnapshot | undefined {
  if (typeof definition !== "object" || definition === null) return undefined;
  const assembly = (definition as { assembly?: AssemblySnapshot }).assembly;
  return assembly && typeof assembly.assemblyId === "string" ? assembly : undefined;
}

/**
 * The same record built from an already-validated logical shape, which is what
 * a command declaring arcs sends. `measurementDefinition` is the vertices-only
 * door onto it, so the shipped straight-path behaviour is literally the same
 * code path with a straight shape.
 */
export function measurementDefinitionOfShape(
  input: { tool: MeasureTool; shape: MeasurementShape; factor: MeasureFactor; assembly?: AssemblySnapshot },
  sheet: PreconSheetRow,
  pick: ScalePick | null,
): MeasurementDefinitionV1 {
  const { tool, shape, factor, assembly } = input;
  const definition: MeasurementDefinitionV1 = { schemaVersion: 1, role: "measurement", tool, shape };
  if (pick && !POINT_TOOLS.includes(tool)) definition.scale = scaleFor(sheet, pick);
  if (factor.heightM !== undefined || factor.depthM !== undefined) definition.factor = { ...factor };
  if (assembly) definition.assembly = { ...assembly };
  return definition;
}

export function measurementDefinition(
  tool: MeasureTool,
  vertices: number[][],
  factor: MeasureFactor,
  sheet: PreconSheetRow,
  pick: ScalePick | null,
  assembly?: AssemblySnapshot,
): MeasurementDefinitionV1 {
  const definition: MeasurementDefinitionV1 = {
    schemaVersion: 1,
    role: "measurement",
    tool,
    shape: shapeFor(tool, vertices),
  };
  // Counting items needs no scale, so recording one would invent a dependency:
  // re-calibrating the drawing would then look as though it restated the count
  // (contracts 2 and 24). Five doors are five doors at any scale.
  if (pick && !POINT_TOOLS.includes(tool)) definition.scale = scaleFor(sheet, pick);
  if (factor.heightM !== undefined || factor.depthM !== undefined) definition.factor = { ...factor };
  // Frozen on purpose: the line keeps the factor, unit and wording the assembly
  // had when it was drawn, so a later rate-card edit cannot restate a signed bill.
  if (assembly) definition.assembly = { ...assembly };
  return definition;
}

const DEDUCTION_MODE_BY_TOOL: Record<MeasureTool, DeductionDefinitionV1["mode"]> = {
  length: "length",
  polyline: "length",
  area: "area",
  count: "count",
  volume: "volume",
  wall_area: "wall-opening",
};

/** An opening stated as dimensions: no shape to record, so the numbers are it. */
export function statedDeductionDefinition(
  parentGeometryId: string,
  mode: DeductionDefinitionV1["mode"],
  dimensions: NonNullable<DeductionDefinitionV1["dimensions"]>,
): DeductionDefinitionV1 {
  return { schemaVersion: 1, role: "deduction", parentGeometryId, mode, dimensions };
}

export function deductionDefinition(
  parentGeometryId: string,
  tool: MeasureTool,
  vertices: number[][],
): DeductionDefinitionV1 {
  return {
    schemaVersion: 1,
    role: "deduction",
    parentGeometryId,
    mode: DEDUCTION_MODE_BY_TOOL[tool],
    shape: shapeFor(tool, vertices),
  };
}

/**
 * The typed record of a figure that was stated rather than drawn. It is the
 * stated line's equivalent of a geometry definition: same purpose, different
 * home, because `precon_boq_rows.measurement_settings` is the only place a line
 * with no shape can keep one (contract 17).
 */
export function statedSettings(
  tool: MeasureTool,
  qty: number,
  unit: string,
  factor: MeasureFactor | undefined,
  actor: string,
): MeasurementSettingsV1 {
  const stated: MeasurementSettingsV1["statedQuantity"] = {
    tool,
    qty,
    unit,
    actor,
    at: new Date().toISOString(),
  };
  if (factor?.heightM !== undefined || factor?.depthM !== undefined) stated.factor = { ...factor };
  return { schemaVersion: 1, quantityMode: "stated", statedQuantity: stated };
}
