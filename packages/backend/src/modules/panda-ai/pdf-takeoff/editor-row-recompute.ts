// What a bill line is worth, added up from every shape still on it.
//
// A line is not one shape. The engine drafts a wall as several runs; a QS adds a
// second bay to an existing item. Every writer here used to read
// `measurementGeometryForRow`, which returns the NEWEST shape and silently
// ignores the rest — so correcting one run of a two-run wall re-billed the line
// as if the other run did not exist, and the figure fell without anyone
// deleting anything.
//
// So the row is re-added instead: each active parent shape is re-measured from
// its OWN definition (its own tool, its own factor, its own scale binding) and
// the contributions are summed in the output unit. Deductions are untouched —
// they belong to the line, not to any one shape — and are applied once at the
// end, which is what keeps an opening from vanishing when the shape beside it
// is corrected.
//
// Rounding follows the shipped contract: each contribution is rounded to 2dp as
// it is measured, then summed, then the deductions and typical are applied.

import { BadRequestError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { hasArc, measureShape, storedShape } from "./measurement-shape.ts";
import { measureVertices, netQuantity } from "./measurements.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { assemblyFactorOf } from "./measurement-definition.ts";
import { boundScale } from "./editor-scale-binding.ts";
import { mmPerPtOf, scaleForTool } from "./viewports.ts";
import type { PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "./types.ts";

const round2 = (v: number): number => Math.round(v * 100) / 100;

export interface RowContribution {
  geometryId: string;
  /** The drawn figure, in the unit it was drawn in — what the shape row stores. */
  base: number;
  baseUnit: string;
  /** The billed figure this shape contributes, after tool and assembly factors. */
  gross: number;
  unit: string;
}

export interface RecomputedRow {
  contributions: RowContribution[];
  gross: number;
  net: number;
  unit: string;
}

export interface RecomputeReader {
  geometries: { geometriesByRow(rowId: string): PromiseLike<PreconGeometryRow[]> };
  sheets: { sheetById(id: string): PromiseLike<PreconSheetRow | undefined> };
}

/** The shapes that make up the line's figure: parents only, tombstones excluded. */
export function contributingShapes(geometries: PreconGeometryRow[]): PreconGeometryRow[] {
  return geometries.filter((geometry) => geometry.kind !== "deduction" && !geometry.deleted_at);
}

/**
 * Re-measure one shape from what it records about itself. Returns null when the
 * shape has no usable definition — a legacy shape nobody has classified yet.
 * The caller decides what that means; it must never be treated as zero.
 */
export function contributionOf(
  geometry: PreconGeometryRow,
  sheet: PreconSheetRow,
  mmPerPtOverride?: number,
): RowContribution | null {
  const resolved = tryResolveMeasureTool(geometry.definition ?? null);
  if (!resolved) return null;
  const { tool, factor } = resolved;
  // Recorded scale first; first-vertex inference only for a shape that recorded
  // nothing. Reversed, a detail dragged off its viewport re-bills at the sheet scale.
  const pick = boundScale(sheet, geometry) ?? scaleForTool(sheet, tool, geometry.vertices);
  const mmPerPt = mmPerPtOverride ?? mmPerPtOf(pick);
  // A curved side is measured from the shape it RECORDS, every time. Measuring
  // the stored tessellation instead sums its chords, so a bay window would lose
  // its bulge on the first unrelated recompute after it was billed.
  const shape = storedShape(geometry.definition ?? null);
  const measured = hasArc(shape)
    ? measureShape(tool, shape!, mmPerPt, factor)
    : measureVertices(tool, geometry.vertices, mmPerPt, factor);
  // An assembly line's own factor is part of what it is billed at, and it is
  // frozen in the shape's definition: the library rate may since have changed,
  // but this line was measured against the factor recorded here.
  const assemblyFactor = assemblyFactorOf(geometry.definition ?? null);
  const gross = assemblyFactor === null ? measured.gross : round2(measured.gross * assemblyFactor);
  return {
    geometryId: geometry.id,
    base: measured.base,
    baseUnit: measured.baseUnit,
    gross,
    unit: assemblyFactor === null ? measured.unit : (assemblyUnitOf(geometry.definition) ?? measured.unit),
  };
}

function assemblyUnitOf(definition: unknown): string | null {
  if (typeof definition !== "object" || definition === null) return null;
  const assembly = (definition as { assembly?: { unit?: unknown } }).assembly;
  return typeof assembly?.unit === "string" ? assembly.unit : null;
}

/**
 * The line's figure, added up from every shape still on it. Refuses rather than
 * guessing when the shapes disagree about the unit: summing m into m2 would
 * produce a number that looks measured and means nothing.
 */
export async function recomputeRow(
  reader: RecomputeReader,
  row: PreconBoqRowRow,
  sessionId: string,
): Promise<RecomputedRow> {
  const shapes = contributingShapes(await reader.geometries.geometriesByRow(row.id));
  const contributions: RowContribution[] = [];
  for (const shape of shapes) {
    const sheet = await reader.sheets.sheetById(shape.sheet_id);
    if (!sheet || sheet.session_id !== sessionId) continue;
    const contribution = contributionOf(shape, sheet);
    if (contribution) contributions.push(contribution);
  }
  if (contributions.length === 0) {
    throw new BadRequestError(
      "None of this line's measurements records how it was measured. Confirm the tool, factor and unit on each before re-measuring.",
    );
  }
  const units = new Set(contributions.map((contribution) => contribution.unit));
  if (units.size > 1) {
    throw new BadRequestError(
      `This line is measured by shapes in different units (${[...units].join(", ")}); they cannot be added together.`,
    );
  }
  const unit = contributions[0]!.unit;
  const gross = round2(contributions.reduce((sum, contribution) => sum + contribution.gross, 0));
  const typical = row.typical ?? 1;
  return { contributions, gross, net: netQuantity(gross, row.deductions ?? [], typical), unit };
}

/** The amount a row carries at a given net figure, or null when it has no rate. */
export function amountFor(row: PreconBoqRowRow, net: number): number | null {
  const rate = num(row.rate);
  return rate === null ? null : Math.round(net * rate * 100) / 100;
}
