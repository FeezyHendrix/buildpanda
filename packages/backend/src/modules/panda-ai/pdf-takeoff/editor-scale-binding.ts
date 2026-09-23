// Which scale a measurement was taken at — read, not re-guessed.
//
// `scaleAt` decides by looking at where the first vertex lands. That is the
// right question to ask ONCE, when a shape is first drawn and has recorded
// nothing about itself. It is the wrong question every time after, because the
// answer can change without the measurement changing:
//
//   * drag a detail out of its viewport and the first vertex now lands on bare
//     sheet, so the shape silently re-measures at the sheet scale — a 1:20
//     detail re-billed at 1:100;
//   * draw a viewport over existing work and lines measured at the sheet scale
//     start reporting themselves as viewport lines;
//   * re-scale the sheet and a line that was never measured against the sheet
//     scale gets restated anyway.
//
// A measurement records the scale it was taken at. So once it does, that record
// governs, and the only thing geometry decides is what to PROPOSE to a human.
// Inference is confined to shapes that have recorded nothing, and even then it
// is offered as a suggestion rather than applied.

import { BadRequestError } from "../../../lib/errors.ts";
import type { ScaleBinding } from "./editor-types.ts";
import type { PreconGeometryRow, PreconSheetRow, ScalePick, SheetViewport } from "./types.ts";
import { isScaleFree, scaleAt, viewportAt } from "./viewports.ts";

/** The binding a shape recorded, or null when it recorded none. */
export function storedBinding(definition: unknown): ScaleBinding | null {
  if (typeof definition !== "object" || definition === null) return null;
  const scale = (definition as { scale?: unknown }).scale;
  if (typeof scale !== "object" || scale === null) return null;
  const { source, appliedMmPerPt } = scale as { source?: unknown; appliedMmPerPt?: unknown };
  if (source !== "sheet" && source !== "viewport") return null;
  if (typeof appliedMmPerPt !== "number" || !Number.isFinite(appliedMmPerPt) || appliedMmPerPt <= 0) return null;
  return scale as ScaleBinding;
}

export const viewportIdOf = (binding: ScaleBinding | null): string | null =>
  binding && binding.source === "viewport" ? (binding.viewportId ?? null) : null;

const viewportById = (sheet: PreconSheetRow, id: string): SheetViewport | null =>
  (sheet.viewports ?? []).find((viewport) => viewport.id === id) ?? null;

/**
 * The scale a RECORDED measurement is measured at. Never geometry-derived: a
 * shape bound to a viewport keeps that viewport's scale wherever it now sits,
 * and a shape bound to the sheet follows the sheet.
 *
 * Returns null when the shape recorded nothing, which is the caller's cue to
 * treat it as unclassified rather than to infer.
 */
export function boundScale(sheet: PreconSheetRow, geometry: PreconGeometryRow | null): ScalePick | null {
  const binding = storedBinding(geometry?.definition ?? null);
  if (!binding) return null;
  if (binding.source === "sheet") {
    const mmPerPt = sheet.scale_mm_per_pt;
    return mmPerPt ? { mmPerPt, viewport: null } : null;
  }
  const id = viewportIdOf(binding);
  const viewport = id ? viewportById(sheet, id) : null;
  // The region it names is gone or renumbered. The figure it was measured at is
  // still the truth of what was drawn, so it is honoured; re-pointing it at a
  // different region is a decision for a human, surfaced as a rebind.
  if (!viewport) return { mmPerPt: binding.appliedMmPerPt, viewport: null };
  return { mmPerPt: viewport.scaleMmPerPt, viewport };
}

/** Does this shape's figure move when the SHEET scale moves? */
export function followsSheetScale(geometry: PreconGeometryRow, tool: string): boolean {
  if (isScaleFree(tool)) return false;
  const binding = storedBinding(geometry.definition ?? null);
  return binding !== null && binding.source === "sheet";
}

const regionOf = (sheet: PreconSheetRow, x: number, y: number): { id: string; mmPerPt: number | null } => {
  const viewport = viewportAt(sheet.viewports, x, y);
  return viewport ? { id: viewport.id, mmPerPt: viewport.scaleMmPerPt } : { id: "sheet", mmPerPt: sheet.scale_mm_per_pt };
};

/**
 * The distinct scales a shape's outline passes over. More than one means the
 * drawn outline spans regions drawn at different scales, and no single
 * mm-per-point is true for the whole of it.
 */
export function scalesSpanned(sheet: PreconSheetRow, vertices: number[][]): number[] {
  const scales = new Set<number>();
  for (const vertex of vertices) {
    const { mmPerPt } = regionOf(sheet, vertex[0] ?? 0, vertex[1] ?? 0);
    if (mmPerPt) scales.add(mmPerPt);
  }
  return [...scales];
}

export interface ScaleChoice {
  source: "sheet" | "viewport";
  viewportId?: string;
}

/**
 * The scale to measure a NEW shape at. Inference is allowed here — this is the
 * one moment nothing has been recorded yet — but a shape crossing two scales is
 * refused rather than resolved by whichever end happened to be drawn first.
 */
export function pickScaleForNew(
  sheet: PreconSheetRow,
  tool: string,
  vertices: number[][],
  choice?: ScaleChoice,
): ScalePick | null {
  if (isScaleFree(tool)) return null;
  if (choice) {
    if (choice.source === "sheet") {
      if (!sheet.scale_mm_per_pt) throw new BadRequestError("Set the sheet scale first");
      return { mmPerPt: sheet.scale_mm_per_pt, viewport: null };
    }
    const viewport = choice.viewportId ? viewportById(sheet, choice.viewportId) : null;
    if (!viewport) throw new BadRequestError("That scale region is not on this drawing");
    return { mmPerPt: viewport.scaleMmPerPt, viewport };
  }
  const spanned = scalesSpanned(sheet, vertices);
  if (spanned.length > 1) {
    throw new BadRequestError(
      `This outline crosses more than one scale (${spanned.map((s) => Math.round(s * 1000) / 1000).join(", ")} mm per point). ` +
        "Say which scale the whole measurement is taken at, or draw it inside one region.",
    );
  }
  return scaleAt(sheet, vertices);
}

export interface RebindSuggestion {
  rowId: string;
  geometryId: string;
  boundViewportId: string | null;
  proposedViewportId: string | null;
  /** Always true: a rebind is offered for a human to accept, never applied. */
  unconfirmed: true;
}

/**
 * A shape now sitting over a different region than the one it records. Reported
 * so the drift is visible; never acted on, because where a shape SITS is not
 * evidence of what it was measured at.
 */
export function rebindSuggestionFor(sheet: PreconSheetRow, geometry: PreconGeometryRow): RebindSuggestion | null {
  const binding = storedBinding(geometry.definition ?? null);
  if (!binding) return null;
  const bound = viewportIdOf(binding);
  const first = geometry.vertices[0];
  if (!first) return null;
  const proposed = regionOf(sheet, first[0] ?? 0, first[1] ?? 0);
  const proposedId = proposed.id === "sheet" ? null : proposed.id;
  if (bound === proposedId) return null;
  return { rowId: geometry.row_id, geometryId: geometry.id, boundViewportId: bound, proposedViewportId: proposedId, unconfirmed: true };
}

export interface LegacySuggestion {
  rowId: string;
  geometryId: string;
  proposedViewportId: string | null;
  proposedMmPerPt: number | null;
  /** Always true: the old first-vertex rule, shown as a starting point only. */
  unconfirmed: true;
}

/**
 * What the pre-binding rule WOULD have picked for an unclassified shape. Offered
 * to a human as a starting point, explicitly unconfirmed — applying it is how a
 * priced line silently acquires a scale nobody chose.
 */
export function legacySuggestionFor(sheet: PreconSheetRow, geometry: PreconGeometryRow): LegacySuggestion {
  const first = geometry.vertices[0];
  const proposed = first ? regionOf(sheet, first[0] ?? 0, first[1] ?? 0) : { id: "sheet", mmPerPt: sheet.scale_mm_per_pt };
  return {
    rowId: geometry.row_id,
    geometryId: geometry.id,
    proposedViewportId: proposed.id === "sheet" ? null : proposed.id,
    proposedMmPerPt: proposed.mmPerPt,
    unconfirmed: true,
  };
}
