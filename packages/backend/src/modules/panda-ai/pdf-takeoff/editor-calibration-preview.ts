// What a new scale would do to a drawing, and the promise that binds the apply.
//
// A calibration restates lines nobody opened, so it is shown before it is
// committed. That only means anything if what was shown is what gets written.
// Before this, the preview returned bare figures: no row versions, no record of
// WHICH lines and shapes it had read. Between the showing and the commit a
// colleague could add a line, correct a run, or drag a detail — and the apply
// would go ahead against a drawing the QS had never seen, restating figures
// that were never in the preview.
//
// So the preview names the sheet version, names every line's version, and
// fingerprints the exact set of lines and shapes it added up. The apply
// recomputes that fingerprint under the lock and refuses on any difference.
//
// Both sides run the SAME scan, so the preview cannot promise one figure and
// the apply write another.

import { createHash } from "node:crypto";
import type { Knex } from "knex";
import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { canonicalJson } from "./editor-fingerprint.ts";
import { recutDeductions, type CutFigure } from "./editor-deduction-recut.ts";
import { contributingShapes, contributionOf, type RowContribution } from "./editor-row-recompute.ts";
import { followsSheetScale, legacySuggestionFor, rebindSuggestionFor } from "./editor-scale-binding.ts";
import type { CalibrationReadContext } from "./editor-unit-of-work.ts";
import { preconGeometryRepository } from "./geometry-repository.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { netQuantity } from "./measurements.ts";
import { preconRowRepository } from "./row-repository.ts";
import { preconSheetRepository } from "./sheet-repository.ts";
import { previewViewports } from "./editor-viewport-apply.ts";
import type {
  CalibrationPreview,
  CalibrationPreviewRow,
  Deduction,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSheetRow,
  ScaleSuggestion,
  ViewportPreview,
  ViewportPreviewBody,
} from "./types.ts";

const round2 = (value: number): number => Math.round(value * 100) / 100;

export function assertScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestError("A sheet scale must be a positive number of millimetres per point");
  }
  return value;
}

export interface RowAtScale {
  row: PreconBoqRowRow;
  contributions: RowContribution[];
  /** The shapes this calibration actually re-measures — sheet-bound, on this sheet. */
  movedGeometryIds: string[];
  gross: number;
  net: number;
  unit: string | null;
  unresolved: boolean;
  /** The line's openings re-cut against each one's OWN parent (contract 6). */
  deductions: Deduction[];
  cuts: CutFigure[];
}

export interface CalibrationScan {
  sheet: PreconSheetRow;
  newScaleMmPerPt: number;
  affected: RowAtScale[];
  unresolvedRowIds: string[];
  rebinds: ScaleSuggestion[];
  legacy: ScaleSuggestion[];
  token: string;
}

const suggestion = (value: { rowId: string; geometryId: string; proposedViewportId: string | null }): ScaleSuggestion => ({
  rowId: value.rowId,
  geometryId: value.geometryId,
  proposedViewportId: value.proposedViewportId,
  unconfirmed: true,
});

/**
 * The identity of what the preview read. Covers the sheet version, every line's
 * version and every shape's drawn state, so a line added, corrected or withdrawn
 * between preview and apply changes it.
 */
function fingerprint(
  sheet: PreconSheetRow,
  newScaleMmPerPt: number,
  rows: PreconBoqRowRow[],
  geometries: PreconGeometryRow[],
): string {
  const material = {
    sheetId: sheet.id,
    sheetVersion: sheet.version ?? 1,
    newScaleMmPerPt,
    rows: [...rows]
      .map((row) => ({ id: row.id, version: row.version }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    geometries: [...geometries]
      .map((geometry) => ({
        id: geometry.id,
        rowId: geometry.row_id,
        sheetId: geometry.sheet_id,
        quantity: num(geometry.quantity),
        vertices: geometry.vertices ?? [],
        deleted: Boolean(geometry.deleted_at),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");
}

/**
 * The drawing a shape sits on, with the sheet being re-scaled substituted for
 * the version this calibration proposes. Everything downstream — contributions,
 * bindings, opening re-cuts — then reads one consistent picture of the drawing
 * as it WOULD be, instead of each caller applying the new scale by hand.
 */
type SheetLookup = (sheetId: string) => PromiseLike<PreconSheetRow | null>;

function sheetLookup(reader: CalibrationReadContext, sessionId: string, substitute: PreconSheetRow): SheetLookup {
  return async (sheetId) => {
    if (sheetId === substitute.id) return substitute;
    const other = await reader.sheets.sheetById(sheetId);
    return other && other.session_id === sessionId ? other : null;
  };
}

interface RowScan {
  sheet: PreconSheetRow;
  row: PreconBoqRowRow;
  /** The parent shapes that make up the line's figure. */
  shapes: PreconGeometryRow[];
  /** Those plus the line's openings, which the re-cut needs to resolve parents. */
  allShapes: PreconGeometryRow[];
  newScaleMmPerPt: number;
  sheetFor: SheetLookup;
}

/**
 * One line as the new scale would leave it, added up from EVERY shape on it and
 * netted by openings re-cut against each one's own parent.
 *
 * The shapes bound to THIS sheet move; a shape bound to a viewport, or measured
 * on another drawing, is re-added at the scale it records. Reading only the
 * newest shape — which is what this used to do — re-billed a wall traced as two
 * runs as though the first run did not exist.
 */
async function rowAtScale(input: RowScan): Promise<RowAtScale | null> {
  const { sheet, row, shapes, allShapes, newScaleMmPerPt, sheetFor } = input;
  const contributions: RowContribution[] = [];
  const movedGeometryIds: string[] = [];
  let unresolved = false;

  for (const shape of shapes) {
    const shapeSheet = await sheetFor(shape.sheet_id);
    if (!shapeSheet) continue;
    const resolved = tryResolveMeasureTool(shape.definition ?? null);
    // A shape on THIS drawing that records nothing is what blocks the apply: it
    // may or may not have been measured at the sheet scale, and a wrong guess
    // does not fail — it produces a smaller number on a priced line.
    if (!resolved) {
      if (shape.sheet_id === sheet.id) unresolved = true;
      continue;
    }
    const moves = shape.sheet_id === sheet.id && followsSheetScale(shape, resolved.tool);
    const contribution = contributionOf(shape, shapeSheet, moves ? newScaleMmPerPt : undefined);
    if (!contribution) {
      if (shape.sheet_id === sheet.id) unresolved = true;
      continue;
    }
    if (moves) movedGeometryIds.push(shape.id);
    contributions.push(contribution);
  }

  if (movedGeometryIds.length === 0 && !unresolved) return null;

  const units = new Set(contributions.map((contribution) => contribution.unit));
  // Summing m into m² produces a number that looks measured and means nothing;
  // and a calibration may never change what a line is billed in.
  if (units.size > 1 || (row.unit !== null && units.size === 1 && !units.has(row.unit))) unresolved = true;

  const recut = await recutDeductions({ row, shapes: allShapes, sheetFor });
  const gross = round2(contributions.reduce((sum, contribution) => sum + contribution.gross, 0));
  const unit = row.unit ?? contributions[0]?.unit ?? null;
  return {
    row,
    contributions,
    movedGeometryIds,
    gross,
    net: netQuantity(gross, recut.deductions, row.typical ?? 1),
    unit,
    unresolved: unresolved || recut.unresolved,
    deductions: recut.deductions,
    cuts: recut.cuts,
  };
}

/**
 * Every line a re-scale of this drawing would move, with the fingerprint of the
 * set it was read from. Shared by the preview and the apply.
 */
export async function scanCalibration(
  reader: CalibrationReadContext,
  sessionId: string,
  sheet: PreconSheetRow,
  newScaleMmPerPt: number,
): Promise<CalibrationScan> {
  const onSheet = await reader.geometries.geometriesBySheet(sheet.id);
  const live = onSheet.filter((geometry) => !geometry.deleted_at);
  const rowIds = [...new Set(live.map((geometry) => geometry.row_id))];
  const rows = await reader.rows.rowsByIds(rowIds);
  // The drawing as this calibration would leave it, so every read below — the
  // contributions, the bindings and the opening re-cuts — sees one picture.
  const sheetFor = sheetLookup(reader, sessionId, { ...sheet, scale_mm_per_pt: newScaleMmPerPt });

  const affected: RowAtScale[] = [];
  const rebinds: ScaleSuggestion[] = [];
  const legacy: ScaleSuggestion[] = [];

  for (const row of rows) {
    const allShapes = await reader.geometries.geometriesByRow(row.id);
    const shapes = contributingShapes(allShapes);
    const outcome = await rowAtScale({ sheet, row, shapes, allShapes, newScaleMmPerPt, sheetFor });
    if (outcome) affected.push(outcome);
    for (const shape of shapes) {
      if (shape.sheet_id !== sheet.id) continue;
      if (!tryResolveMeasureTool(shape.definition ?? null)) {
        legacy.push(suggestion(legacySuggestionFor(sheet, shape)));
        continue;
      }
      const rebind = rebindSuggestionFor(sheet, shape);
      if (rebind) rebinds.push(suggestion(rebind));
    }
  }

  return {
    sheet,
    newScaleMmPerPt,
    affected,
    unresolvedRowIds: affected.filter((entry) => entry.unresolved).map((entry) => entry.row.id),
    rebinds,
    legacy,
    token: fingerprint(sheet, newScaleMmPerPt, rows, onSheet),
  };
}

const previewRowOf = (entry: RowAtScale): CalibrationPreviewRow => ({
  rowId: entry.row.id,
  description: entry.row.description,
  version: entry.row.version,
  currentQtyGross: num(entry.row.qty_gross),
  newQtyGross: entry.unresolved ? null : entry.gross,
  currentQty: num(entry.row.qty),
  newQty: entry.unresolved ? null : entry.net,
  unit: entry.unit,
  contributions: entry.contributions.length,
  hasUnresolvableBasis: entry.unresolved,
});

export function previewOf(scan: CalibrationScan): CalibrationPreview {
  return {
    sheetId: scan.sheet.id,
    currentScaleMmPerPt: scan.sheet.scale_mm_per_pt,
    newScaleMmPerPt: scan.newScaleMmPerPt,
    sheetVersion: scan.sheet.version ?? 1,
    affectedRows: scan.affected.map(previewRowOf),
    unresolvedCount: scan.unresolvedRowIds.length,
    unresolvedRowIds: scan.unresolvedRowIds,
    blocked: scan.unresolvedRowIds.length > 0,
    rebindSuggestions: scan.rebinds,
    legacySuggestions: scan.legacy,
    previewToken: scan.token,
  };
}

export const STALE_PREVIEW =
  "This drawing changed since the re-scale was previewed, so the figures you approved are no longer what would be written. " +
  "Refresh the preview and reapply.";

export function assertPreviewStillHolds(scan: CalibrationScan, previewToken: string | undefined): void {
  if (previewToken !== undefined && previewToken !== scan.token) throw new ConflictError(STALE_PREVIEW);
}

/**
 * The read side of a calibration. Runs in a repeatable-read transaction so the
 * figures, the versions and the fingerprint all describe ONE state of the
 * drawing — a preview assembled from several unlocked reads can promise a total
 * that never existed.
 */
export function calibrationPreviewService(db: Knex) {
  const coherentRead = <T>(read: (reader: CalibrationReadContext) => Promise<T>): Promise<T> =>
    db.transaction(
      (trx) =>
        read({
          sheets: preconSheetRepository(trx),
          geometries: preconGeometryRepository(trx),
          rows: preconRowRepository(trx),
        }),
      { isolationLevel: "repeatable read", readOnly: true },
    );

  return {
    async calibration(
      sessionId: string,
      sheetId: string,
      body: { newScaleMmPerPt: number },
    ): Promise<CalibrationPreview> {
      const mmPerPt = assertScale(body.newScaleMmPerPt);
      return coherentRead(async (reader) => {
        const sheet = await reader.sheets.sheetById(sheetId);
        if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
        return previewOf(await scanCalibration(reader, sessionId, sheet, mmPerPt));
      });
    },

    viewports(sessionId: string, sheetId: string, body: ViewportPreviewBody): Promise<ViewportPreview> {
      return coherentRead((reader) => previewViewports(reader, sessionId, sheetId, body));
    },
  };
}
