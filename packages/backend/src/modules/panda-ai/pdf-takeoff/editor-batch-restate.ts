// The reads and the one write every bulk edit shares.
//
// Splitting, trimming, copying, merging and reassigning all end the same way:
// the line's gross becomes the sum of the drawings it now carries, its net is
// taken off that, and its sign-off is cleared because the figure a QS put
// their name to no longer exists. Written once here rather than five times, so
// a line restated by a merge and a line restated by a split cannot drift into
// meaning two different things.

import { recomputeRow } from "./editor-row-recompute.ts";
import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import type { MergeCandidate } from "./editor-batch-rules.ts";
import type { BatchWriteContext, EditorWriteContext } from "./editor-unit-of-work.ts";
import { factorClause } from "./editor-writers.ts";
import { resolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import { DEFAULT_UNITS, measureVertices, netQuantity } from "./measurements.ts";
import { reviewResetPatch } from "./review-policy.ts";
import type { RowChangeEvent } from "./service.ts";
import {scaleClause, scaleForTool, mmPerPtOf} from "./viewports.ts";
import type {
  MeasureFactor,
  MeasureTool,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSheetRow,
  ScalePick,
} from "./types.ts";

const STALE = "Row changed since you loaded it; refresh and retry";

const round2 = (v: number): number => Math.round(v * 100) / 100;

export const drawnOnly = (geometries: PreconGeometryRow[]): PreconGeometryRow[] =>
  geometries.filter((g) => g.kind !== "deduction");

/** A caller-named sheet is checked against the session; otherwise one session could edit another's drawings. */
export async function requireSessionSheet(ctx: EditorWriteContext, sessionId: string, sheetId: string): Promise<PreconSheetRow> {
  const sheet = await ctx.sheets.sheetById(sheetId);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  return sheet;
}

export interface MeasuredLine {
  geometry: PreconGeometryRow;
  sheet: PreconSheetRow;
  tool: MeasureTool;
  factor: MeasureFactor;
  pick: ScalePick | null;
  /** The row's other drawings: untouched by the edit, still part of its total. */
  others: number[][][];
}

export async function measuredLine(ctx: EditorWriteContext, sessionId: string, row: PreconBoqRowRow, verb: string): Promise<MeasuredLine> {
  const geometry = await ctx.geometries.measurementGeometryForRow(row.id);
  if (!geometry) throw new BadRequestError(`Measure this line before ${verb} it`);
  const sheet = await requireSessionSheet(ctx, sessionId, geometry.sheet_id);
  // Refuses rather than guesses: a line whose tool cannot be established would
  // be re-billed at its bare base figure, which still looks measured.
  const { tool, factor } = resolveMeasureTool(geometry.definition ?? null);
  const others = drawnOnly(await ctx.geometries.geometriesByRow(row.id)).filter((g) => g.id !== geometry.id);
  return { geometry, sheet, tool, factor, pick: scaleForTool(sheet, tool, geometry.vertices), others: others.map((g) => g.vertices) };
}

export interface Restatement {
  row: PreconBoqRowRow;
  version: number;
  tool: MeasureTool;
  factor: MeasureFactor;
  /** Every drawing the line carries once the edit lands; its gross is their sum. */
  drawn: number[][][];
  sheet: PreconSheetRow;
  pick: ScalePick | null;
  head: string;
  event: RowChangeEvent["type"];
}

export async function restateRow(ctx: EditorWriteContext, sessionId: string, r: Restatement, actor: string): Promise<PreconBoqRowRow> {
  const gross = round2(r.drawn.reduce((total, v) => total + measureVertices(r.tool, v, mmPerPtOf(r.pick), r.factor).gross, 0));
  const typical = r.row.typical ?? 1;
  const unit = r.row.unit ?? DEFAULT_UNITS[r.tool];
  const net = netQuantity(gross, r.row.deductions ?? [], typical);
  const head = `${r.head}${factorClause(r.tool, r.factor)}; gross ${gross} ${unit}${scaleClause(r.sheet, r.pick)}`;
  const updated = await ctx.rows.updateRowVersioned(r.row.id, r.version, {
    qty_gross: gross,
    qty: net,
    unit,
    measurement_basis: basisFor({ basis: head, gross, deductions: r.row.deductions ?? [], typical, net, unit }),
    amount: r.row.rate !== null ? Math.round(net * Number(r.row.rate) * 100) / 100 : null,
    ...reviewResetPatch(),
  });
  if (!updated) throw new ConflictError(STALE);
  ctx.emit({ type: r.event, sessionId, rowId: r.row.id, version: updated.version, actor, changes: { qty: net, qtyGross: gross } });
  return updated;
}

/**
 * The same restatement for a line whose shapes are NOT all on one drawing.
 *
 * `restateRow` measures every outline at one sheet's scale, which is right for
 * a copy that stayed put and wrong for a line measured across two drawings: the
 * shape on the other sheet would be re-billed at this one's scale. The row
 * recompute reads each shape's own sheet and its own binding, so it is the only
 * correct engine once more than one drawing is involved.
 */
export async function restateAcrossSheets(
  ctx: EditorWriteContext,
  sessionId: string,
  r: { row: PreconBoqRowRow; version: number; head: string; event: RowChangeEvent["type"] },
  actor: string,
): Promise<PreconBoqRowRow> {
  const recomputed = await recomputeRow(ctx, r.row, sessionId);
  const typical = r.row.typical ?? 1;
  const net = netQuantity(recomputed.gross, r.row.deductions ?? [], typical);
  const head = `${r.head}; gross ${recomputed.gross} ${recomputed.unit}`;
  const updated = await ctx.rows.updateRowVersioned(r.row.id, r.version, {
    qty_gross: recomputed.gross,
    qty: net,
    unit: recomputed.unit,
    measurement_basis: basisFor({
      basis: head,
      gross: recomputed.gross,
      deductions: r.row.deductions ?? [],
      typical,
      net,
      unit: recomputed.unit,
    }),
    amount: r.row.rate !== null ? Math.round(net * Number(r.row.rate) * 100) / 100 : null,
    ...reviewResetPatch(),
  });
  if (!updated) throw new ConflictError(STALE);
  ctx.emit({ type: r.event, sessionId, rowId: r.row.id, version: updated.version, actor, changes: { qty: net, qtyGross: recomputed.gross } });
  return updated;
}

/** The named lines, in the order asked for, proved to belong to this session. One query for the rows, one for the bills. */
export async function sessionRows(ctx: BatchWriteContext, sessionId: string, rowIds: string[]): Promise<PreconBoqRowRow[]> {
  const [found, bills] = await Promise.all([ctx.rows.rowsByIds(rowIds), ctx.bills.billsBySession(sessionId)]);
  const inSession = new Set(bills.map((b) => b.id));
  return rowIds.map((id) => {
    const row = found.find((r) => r.id === id);
    if (!row || !inSession.has(row.bill_id)) throw new NotFoundError("BOQ row");
    return row;
  });
}

export function geometriesByRowId(geometries: PreconGeometryRow[]): Map<string, PreconGeometryRow[]> {
  const byRow = new Map<string, PreconGeometryRow[]>();
  for (const geometry of geometries) {
    const drawn = byRow.get(geometry.row_id);
    if (drawn) drawn.push(geometry);
    else byRow.set(geometry.row_id, [geometry]);
  }
  return byRow;
}

export interface MergeLine extends MergeCandidate {
  row: PreconBoqRowRow;
  /** Every drawing the line is measured by, oldest first. Never empty. */
  shapes: PreconGeometryRow[];
}

const sameFactor = (a: MeasureFactor, b: MeasureFactor): boolean =>
  (a.heightM ?? null) === (b.heightM ?? null) && (a.depthM ?? null) === (b.depthM ?? null);

/**
 * A line as a merge candidate: all of its drawings, and the one basis they
 * share.
 *
 * A line measured by SEVERAL drawings is ordinary — the engine drafts a wall as
 * three runs, a QS moves a second bay onto an item — so refusing it on the
 * count was refusing the common case. What a merge genuinely cannot do is take
 * a line that has no single answer to "what is this measured with": drawings on
 * two sheets have no shared coordinate space to union in, and drawings at two
 * different heights have no one factor the merged line could be billed at.
 * Those are refused by name, so the QS knows which line to split first.
 */
export function mergeLine(row: PreconBoqRowRow, geometries: PreconGeometryRow[]): MergeLine {
  const shapes = drawnOnly(geometries).filter((shape) => !shape.deleted_at);
  const first = shapes[0];
  if (!first) throw new BadRequestError(`Measure line ${row.id} before merging it`);

  const sheetIds = new Set(shapes.map((shape) => shape.sheet_id));
  if (sheetIds.size > 1) {
    throw new BadRequestError(
      `Line ${row.id} is measured across ${sheetIds.size} drawings; merge lines measured on one drawing each`,
    );
  }
  const resolved = shapes.map((shape) => resolveMeasureTool(shape.definition ?? null));
  const basis = resolved[0]!;
  if (resolved.some((other) => other.tool !== basis.tool || !sameFactor(other.factor, basis.factor))) {
    throw new BadRequestError(
      `Line ${row.id} is measured with more than one tool or height; merge lines measured one way each`,
    );
  }
  return {
    row,
    rowId: row.id,
    sheetId: first.sheet_id,
    tool: basis.tool,
    factor: basis.factor,
    unit: row.unit,
    typical: row.typical ?? 1,
    rate: num(row.rate),
    shapes,
  };
}
