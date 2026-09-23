// Which tool made this line, and what a redraw of it must still be worth.
//
// A stored measurement is only re-measurable if the tool that made it survives.
// `measureVertices(tool, …)` knows that a 7 m wall run at 2.7 m high is 18.9 m2;
// the older redraw path only knew the geometry KIND ("linear"), so redrawing the
// same wall quietly billed its bare 7 m run. This file is the seam that keeps the
// tool attached.
//
// It reads the tool from the stored definition and from NOTHING ELSE. Scraping
// height/depth out of `measurement_basis` prose ("… × 2.7 m height") was removed
// deliberately: that sentence is a description, not a record, so wording that
// differs by a word re-bills a priced line at a different figure (contract 3).
// A line with no definition is unclassified legacy — the QS confirms its tool,
// factor and unit explicitly, and until they do the edit is refused. Do not
// re-add a prose fallback as a convenience.

import { BadRequestError } from "../../../lib/errors.ts";
import { measureVertices, validateGeometry } from "./measurements.ts";
import { MEASURE_TOOLS, type DeductionMode, type DefinitionConfirmation, type MeasureFactor, type MeasureTool } from "./types.ts";

export type { DefinitionConfirmation };

export interface ResolvedTool {
  tool: MeasureTool;
  factor: MeasureFactor;
  /** True when the QS supplied the tool for a line that never recorded one. */
  confirmed: boolean;
}

export interface MeasurementFacts {
  tool: MeasureTool | null;
  heightM: number | null;
  depthM: number | null;
}

export interface RedrawQuantity {
  quantity: number;
  unit: string;
  base: number;
  baseUnit: string;
}

export const SET_TOOL_FIRST =
  "This line does not record which tool measured it. Confirm the tool (and its height or depth), " +
  "unit and scale against the saved measurement basis in the inspector, then redraw.";

/** The tool and factor a stored definition records, when it records a measurement. */
function fromDefinition(definition: unknown): ResolvedTool | null {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) return null;
  const raw = definition as Record<string, unknown>;
  if (raw["role"] !== "measurement") return null;
  const tool = raw["tool"];
  if (typeof tool !== "string" || !(MEASURE_TOOLS as readonly string[]).includes(tool)) return null;
  const stored = raw["factor"];
  const factor: MeasureFactor = {};
  if (typeof stored === "object" && stored !== null) {
    const f = stored as Record<string, unknown>;
    if (typeof f["heightM"] === "number" && f["heightM"] > 0) factor.heightM = f["heightM"];
    if (typeof f["depthM"] === "number" && f["depthM"] > 0) factor.depthM = f["depthM"];
  }
  return { tool: tool as MeasureTool, factor, confirmed: false };
}

function fromConfirmation(confirmation: DefinitionConfirmation | null | undefined): ResolvedTool | null {
  if (!confirmation) return null;
  if (!(MEASURE_TOOLS as readonly string[]).includes(confirmation.tool)) {
    throw new BadRequestError(`Confirm one of ${MEASURE_TOOLS.join(", ")} as the tool that measured this line`);
  }
  const factor: MeasureFactor = {};
  if (confirmation.factor?.heightM !== undefined) factor.heightM = confirmation.factor.heightM;
  if (confirmation.factor?.depthM !== undefined) factor.depthM = confirmation.factor.depthM;
  if (confirmation.tool === "wall_area" && !(factor.heightM && factor.heightM > 0)) {
    throw new BadRequestError("Confirm the wall height in metres before re-measuring this line");
  }
  if (confirmation.tool === "volume" && !(factor.depthM && factor.depthM > 0)) {
    throw new BadRequestError("Confirm the depth in metres before re-measuring this line");
  }
  return { tool: confirmation.tool, factor, confirmed: true };
}

/**
 * The tool a redraw of this line must be measured with: the stored definition,
 * or the QS's explicit confirmation for a legacy line that never stored one.
 * Never the basis sentence.
 */
export function tryResolveMeasureTool(
  definition: unknown,
  confirmation?: DefinitionConfirmation | null,
): ResolvedTool | null {
  return fromDefinition(definition) ?? fromConfirmation(confirmation);
}

/**
 * What the stored definition *records*, for read-only surfaces (Panda AI, the
 * assist context). It never falls back to the basis sentence: a null tool is
 * the honest answer that the basis was never recorded, which is exactly the
 * signal those surfaces need to flag a line for factor review.
 */
export function measurementFacts(definition: unknown): MeasurementFacts {
  const resolved = fromDefinition(definition);
  return {
    tool: resolved?.tool ?? null,
    heightM: resolved?.factor.heightM ?? null,
    depthM: resolved?.factor.depthM ?? null,
  };
}

export function resolveMeasureTool(definition: unknown, confirmation?: DefinitionConfirmation | null): ResolvedTool {
  const resolved = tryResolveMeasureTool(definition, confirmation);
  if (!resolved) throw new BadRequestError(SET_TOOL_FIRST);
  return resolved;
}

/**
 * The tool-aware replacement for `quantityFromVertices`: it validates the shape
 * first and applies the tool's factor, so a redrawn wall keeps its height and a
 * two-point "area" is refused instead of shoelacing to a quiet zero.
 */
export function quantityFromRedraw(
  tool: MeasureTool,
  vertices: number[][],
  mmPerPt: number,
  factor: MeasureFactor = {},
): RedrawQuantity {
  validateGeometry(tool, vertices, factor);
  const measured = measureVertices(tool, vertices, mmPerPt, factor);
  return { quantity: measured.gross, unit: measured.unit, base: measured.base, baseUnit: measured.baseUnit };
}

// ---------- deductions ----------

/** A deduction is measured in the unit of the line it nets off; nothing else can be subtracted from it. */
export function deductionToolFor(parentUnit: string | null): MeasureTool {
  if (!parentUnit) {
    throw new BadRequestError("Measure this line before taking a deduction off it — a deduction needs its parent's unit");
  }
  switch (parentUnit) {
    case "m":
      return "polyline";
    case "nr":
      return "count";
    case "m2":
      return "area";
    case "m3":
      return "volume";
    default:
      throw new BadRequestError(`A deduction cannot be taken off a line measured in ${parentUnit}`);
  }
}

export interface MeasuredDeduction {
  tool: MeasureTool;
  qty: number;
  unit: string;
}

/** The one mode each measuring tool's openings are recorded in. */
const MODE_FOR_TOOL: Record<MeasureTool, DeductionMode> = {
  polyline: "length",
  length: "length",
  area: "area",
  volume: "volume",
  count: "count",
  wall_area: "area",
};

/**
 * The declared mode against the dimension the line is actually billed in.
 *
 * `deductionToolFor` derives the tool from the PARENT's unit, and
 * `measureDeduction` then compared the measured unit against that same parent
 * unit — both sides of the check came from one place, so it could never fail.
 * The caller's own `mode` was read only on the stated-dimensions branch, so on
 * the vertices branch a declared `area` was dropped and the rectangle was
 * re-measured as an open path: 2 m² asked for, 5 m deducted, the mode rewritten
 * to `length` and the result stamped as confirmed.
 *
 * A declared mode is therefore honoured or refused, never substituted.
 * `wall-opening` is the one legitimate cross-form — a width × height off an
 * elevation billed in m² — so it is accepted wherever an area is.
 *
 * Silence still means the shipped behaviour: four points on a line billed in
 * metres is a legitimate three-segment run, and nothing in the request
 * distinguishes that from a rectangle unless the caller says so.
 */
export function assertDeductionMode(parentUnit: string, tool: MeasureTool, declared: DeductionMode | undefined): void {
  if (declared === undefined) return;
  const expected = MODE_FOR_TOOL[tool];
  if (declared === expected) return;
  if (declared === "wall-opening" && expected === "area") return;
  throw new BadRequestError(
    `This line is billed in ${parentUnit}, so an opening off it is measured as ${expected}, not as ${declared}. ` +
      `Re-draw it as ${expected}, or take it off a line billed in the unit you meant.`,
  );
}

/**
 * The drawn opening as a figure in the parent's own unit. An area taken off a
 * length row is the classic silent error: 3.2 m2 of window subtracted from a
 * 40 m run of skirting reads as a number and nets off nothing real.
 */
export function measureDeduction(
  parentUnit: string | null,
  vertices: number[][],
  mmPerPt: number,
  factor: MeasureFactor = {},
  declaredMode?: DeductionMode,
): MeasuredDeduction {
  const tool = deductionToolFor(parentUnit);
  assertDeductionMode(parentUnit!, tool, declaredMode);
  if (tool === "volume" && !(factor.depthM && factor.depthM > 0)) {
    throw new BadRequestError("A deduction from a volume needs the depth it is cut out of; re-measure the line to record it");
  }
  validateGeometry(tool, vertices, factor);
  const measured = measureVertices(tool, vertices, mmPerPt, factor);
  if (measured.unit !== parentUnit) {
    throw new BadRequestError(`A deduction off a line measured in ${parentUnit} must be in ${parentUnit}, not ${measured.unit}`);
  }
  return { tool, qty: measured.gross, unit: measured.unit };
}
