// What changing a drawing's scale regions would do to the figures taken in them.
//
// A viewport is the scale a detail was drawn at, so editing one is a
// re-calibration of everything measured inside it — and the effect is invisible
// from the region itself: the numbers live on bill lines that nobody opened.
//
// Rather than predicting the effect by comparing scales, both sides are MEASURED:
// each line is re-added once against the drawing as it stands and once against
// the drawing as proposed, and a line is affected when those two disagree. That
// catches the cases a scale comparison misses — a shape whose binding names a
// region being withdrawn, a shape that records no binding and is measured by
// where it sits, a line measured partly on another drawing.

import { createHash } from "node:crypto";
import { num } from "./dto.ts";
import { canonicalJson } from "./editor-fingerprint.ts";
import { recutDeductions, type CutFigure } from "./editor-deduction-recut.ts";
import { contributingShapes, contributionOf } from "./editor-row-recompute.ts";
import { storedBinding, viewportIdOf } from "./editor-scale-binding.ts";
import type { CalibrationReadContext } from "./editor-unit-of-work.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { netQuantity } from "./measurements.ts";
import { viewportAt } from "./viewports.ts";
import type {
  Deduction,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSheetRow,
  RemovedRegion,
  SheetViewport,
  ViewportImpactRow,
  ViewportPreview,
} from "./types.ts";

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** An impacted line plus the re-cut openings the apply must write with it. */
export interface ScannedRow extends ViewportImpactRow {
  deductions: Deduction[];
  cuts: CutFigure[];
}

export interface ViewportScan {
  sheet: PreconSheetRow;
  proposed: SheetViewport[];
  rescaled: ScannedRow[];
  removed: RemovedRegion[];
  unresolvedRowIds: string[];
  token: string;
}

/**
 * The identity of what the preview read: the drawing's version and regions, the
 * lines and their versions, every shape's drawn state, AND the regions being
 * proposed. A line added or corrected between the showing and the commit changes
 * it, and so does proposing a different set of regions than the one shown.
 */
function fingerprint(
  sheet: PreconSheetRow,
  proposed: SheetViewport[],
  rows: PreconBoqRowRow[],
  geometries: PreconGeometryRow[],
): string {
  const material = {
    sheetId: sheet.id,
    sheetVersion: sheet.version ?? 1,
    currentViewports: sheet.viewports ?? [],
    proposed: proposed.map((viewport) => ({
      id: viewport.id,
      label: viewport.label,
      rect: viewport.rect,
      scaleMmPerPt: viewport.scaleMmPerPt,
    })),
    rows: [...rows].map((row) => ({ id: row.id, version: row.version })).sort((a, b) => a.id.localeCompare(b.id)),
    geometries: [...geometries]
      .map((geometry) => ({
        id: geometry.id,
        rowId: geometry.row_id,
        quantity: num(geometry.quantity),
        vertices: geometry.vertices ?? [],
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");
}

interface RowFigure {
  gross: number;
  net: number;
  unit: string | null;
  deductions: Deduction[];
  cuts: CutFigure[];
  unresolved: boolean;
}

interface RowUnder {
  substitute: PreconSheetRow;
  row: PreconBoqRowRow;
  /** The parent shapes that make up the figure. */
  shapes: PreconGeometryRow[];
  /** Those plus the line's openings, which the re-cut needs to resolve parents. */
  allShapes: PreconGeometryRow[];
}

/**
 * A line's figure, added up from every shape on it and netted by openings re-cut
 * against each one's own parent, with ONE drawing swapped for a proposed version
 * of itself. Shapes measured on other drawings are re-added at the scale they
 * record there, so a line spanning two sheets is not restated by half.
 */
async function figureUnder(
  reader: CalibrationReadContext,
  sessionId: string,
  input: RowUnder,
): Promise<RowFigure | null> {
  const { substitute, row, shapes, allShapes } = input;
  const sheetFor = async (sheetId: string): Promise<PreconSheetRow | null> => {
    if (sheetId === substitute.id) return substitute;
    const other = await reader.sheets.sheetById(sheetId);
    return other && other.session_id === sessionId ? other : null;
  };

  let gross = 0;
  let unit: string | null = null;
  let measured = false;
  for (const shape of shapes) {
    const sheet = await sheetFor(shape.sheet_id);
    if (!sheet) continue;
    const contribution = contributionOf(shape, sheet);
    if (!contribution) continue;
    gross += contribution.gross;
    unit ??= contribution.unit;
    measured = true;
  }
  if (!measured) return null;
  const recut = await recutDeductions({ row, shapes: allShapes, sheetFor });
  const rounded = round2(gross);
  return {
    gross: rounded,
    net: netQuantity(rounded, recut.deductions, row.typical ?? 1),
    unit,
    deductions: recut.deductions,
    cuts: recut.cuts,
    unresolved: recut.unresolved,
  };
}

/**
 * Lines on this drawing that a region change would move but that CANNOT be
 * re-measured: a shape with no recorded basis sitting in a region whose scale is
 * changing. Its figure was taken at that region's old scale and nothing on it
 * says so, and a region change that restates its neighbours while leaving it
 * alone produces a bill whose parts were measured at two different scales.
 */
function unresolvedUnder(
  sheet: PreconSheetRow,
  proposed: SheetViewport[],
  live: PreconGeometryRow[],
): string[] {
  const current = sheet.viewports ?? [];
  const proposedById = new Map(proposed.map((viewport) => [viewport.id, viewport]));
  const moved = new Set<string>();
  for (const viewport of current) {
    const next = proposedById.get(viewport.id);
    if (!next || next.scaleMmPerPt !== viewport.scaleMmPerPt) moved.add(viewport.id);
    else if (next.rect.some((value, axis) => value !== viewport.rect[axis])) moved.add(viewport.id);
  }
  for (const viewport of proposed) if (!current.some((one) => one.id === viewport.id)) moved.add(viewport.id);
  if (moved.size === 0) return [];

  const rowIds = new Set<string>();
  for (const shape of live) {
    if (shape.kind === "deduction" || tryResolveMeasureTool(shape.definition ?? null)) continue;
    const first = shape.vertices[0];
    if (!first) continue;
    const before = viewportAt(current, first[0] ?? 0, first[1] ?? 0);
    const after = viewportAt(proposed, first[0] ?? 0, first[1] ?? 0);
    if ((before && moved.has(before.id)) || (after && moved.has(after.id))) rowIds.add(shape.row_id);
  }
  return [...rowIds];
}

function regionsWithdrawn(
  sheet: PreconSheetRow,
  proposed: SheetViewport[],
  shapes: PreconGeometryRow[],
  rows: Map<string, PreconBoqRowRow>,
): RemovedRegion[] {
  const kept = new Set(proposed.map((viewport) => viewport.id));
  const labels = new Map((sheet.viewports ?? []).map((viewport) => [viewport.id, viewport.label]));
  const withdrawn = new Map<string, RemovedRegion>();
  for (const shape of shapes) {
    const viewportId = viewportIdOf(storedBinding(shape.definition ?? null));
    if (viewportId === null || kept.has(viewportId)) continue;
    const region = withdrawn.get(viewportId) ?? {
      viewportId,
      label: labels.get(viewportId) ?? viewportId,
      measurements: [],
    };
    region.measurements.push({
      rowId: shape.row_id,
      geometryId: shape.id,
      description: rows.get(shape.row_id)?.description ?? "",
    });
    withdrawn.set(viewportId, region);
  }
  return [...withdrawn.values()];
}

/**
 * Every line a change to this drawing's regions would move, the regions it
 * withdraws, and the fingerprint of the set it was all read from. Shared by the
 * preview and the apply so neither can promise what the other does not write.
 */
export async function scanViewports(
  reader: CalibrationReadContext,
  sessionId: string,
  sheet: PreconSheetRow,
  proposed: SheetViewport[],
): Promise<ViewportScan> {
  const live = (await reader.geometries.geometriesBySheet(sheet.id)).filter((shape) => !shape.deleted_at);
  const rows = await reader.rows.rowsByIds([...new Set(live.map((shape) => shape.row_id))]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const asProposed: PreconSheetRow = { ...sheet, viewports: proposed };

  const rescaled: ScannedRow[] = [];
  const unresolvedRowIds = new Set(unresolvedUnder(sheet, proposed, live));
  for (const row of rows) {
    const allShapes = await reader.geometries.geometriesByRow(row.id);
    const shapes = contributingShapes(allShapes);
    const [current, next] = await Promise.all([
      figureUnder(reader, sessionId, { substitute: sheet, row, shapes, allShapes }),
      figureUnder(reader, sessionId, { substitute: asProposed, row, shapes, allShapes }),
    ]);
    if (!next || !current) continue;
    if (next.unresolved) unresolvedRowIds.add(row.id);
    if (current.gross === next.gross && current.net === next.net) continue;
    rescaled.push({
      rowId: row.id,
      description: row.description,
      version: row.version,
      currentQtyGross: num(row.qty_gross),
      newQtyGross: next.gross,
      currentQty: num(row.qty),
      newQty: next.net,
      unit: row.unit ?? next.unit,
      deductions: next.deductions,
      cuts: next.cuts,
    });
  }

  const removed = regionsWithdrawn(sheet, proposed, live, byId);
  return {
    sheet,
    proposed,
    rescaled,
    removed,
    unresolvedRowIds: [...unresolvedRowIds],
    token: fingerprint(sheet, proposed, rows, live),
  };
}

export function viewportPreviewOf(scan: ViewportScan): ViewportPreview {
  return {
    sheetId: scan.sheet.id,
    sheetVersion: scan.sheet.version ?? 1,
    rescaled: scan.rescaled.map(({ deductions: _d, cuts: _c, ...shown }) => shown),
    removed: scan.removed,
    unresolvedRowIds: scan.unresolvedRowIds,
    blocked: scan.removed.length > 0 || scan.unresolvedRowIds.length > 0,
    previewToken: scan.token,
  };
}
