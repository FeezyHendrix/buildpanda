// The whole life of an opening taken out of a measured line: cut, corrected,
// withdrawn. All three restate a figure on a contractual record, so all three run
// inside the editor's unit of work — one lock, one transaction, one audit entry —
// and all three now go through the operation envelope, so all three are undoable.
//
// The opening keeps its geometry id through an edit. `row.deductions[].geometryId`
// names it, so replacing the shape with a fresh row would leave a billed figure
// pointing at nothing.
//
// Every one of the three also restates `measurement_basis`. It did not before, so
// a line could read "24 m2 area on GA-01" while billing 22 m2 — the sentence a
// dispute is read from disagreeing with the figure beside it.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { num, toRow } from "./dto.ts";
import { assertInsideParent, assertNoOverlap, statedCut } from "./editor-deduction-geometry.ts";
import { overlapArea } from "./measurement-topology.ts";
import { amountFor, recomputeRow } from "./editor-row-recompute.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-write-helpers.ts";
import { deductionDefinition, statedDeductionDefinition } from "./measurement-definition.ts";
import { deductionToolFor, measureDeduction, tryResolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity } from "./measurements.ts";
import { measuredStateOf, reviewPatchFor } from "./review-policy.ts";
import { boundScale } from "./editor-scale-binding.ts";
import { mmPerPtOf, scaleForTool } from "./viewports.ts";
import type {
  AddDeductionBody,
  Deduction,
  EditDeductionBody,
  MeasureTool,
  PreconBoqRowDto,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSheetRow,
  RemoveDeductionBody,
} from "./types.ts";

const STALE = "Row changed since you loaded it; refresh and retry";

/** Openings that enclose an area can share one; a run or a tally cannot. */
const AREA_DEDUCTION_TOOLS: readonly MeasureTool[] = ["area", "volume"];

const round2 = (v: number): number => Math.round(v * 100) / 100;

const OVER_DEDUCTED = "Deductions exceed gross";

function totalDeducted(deductions: Deduction[]): number {
  return round2(deductions.reduce((sum, entry) => sum + entry.qty, 0));
}

/**
 * Contract 22's repair rule. A line whose openings already exceed its gross keeps
 * loading and exporting its clamped zero, flagged — no migration rewrites it. From
 * there:
 *   * a change that creates or WORSENS the deficit is refused;
 *   * a change that reduces it but does not clear it may save, still showing zero
 *     and needing review, with the flag retained;
 *   * clearing it entirely returns the line to an ordinary figure.
 * Without the middle case a QS cannot repair a legacy line one opening at a time.
 */
function assertRepairsDeficit(gross: number, before: Deduction[], after: Deduction[]): { deficit: number } {
  const was = round2(totalDeducted(before) - gross);
  const now = round2(totalDeducted(after) - gross);
  if (now <= 0) return { deficit: 0 };
  if (was <= 0) {
    throw new BadRequestError(
      `These openings would take ${round2(totalDeducted(after))} out of a ${gross} gross, leaving nothing to bill. ` +
        "Reduce the openings, or re-measure the line they come off.",
    );
  }
  if (now >= was) {
    throw new BadRequestError(
      `This line already has more deducted than measured (${OVER_DEDUCTED.toLowerCase()} by ${was}); ` +
        "this change does not reduce it. Repair the line by reducing the openings or re-measuring it.",
    );
  }
  return { deficit: now };
}

function deductionIndex(deductions: Deduction[], geometryId: string): number {
  const index = deductions.findIndex((d) => d.geometryId === geometryId);
  if (index < 0) throw new NotFoundError("Deduction");
  return index;
}

/**
 * The drawing an opening is actually a hole in.
 *
 * `measurementGeometryForRow` returns the NEWEST drawing on the line, which is
 * the right answer only while a line carries one. On a line measured by two —
 * a wall that turns the corner, a slab that gained a bay — it means a void
 * drawn inside the first is checked against, and bound to the scale of, the
 * second: refused as "not inside the measurement" when it plainly is, or worse,
 * accepted and measured at the wrong region's scale.
 *
 * So the parent is the outline that actually contains the cut. A STATED opening
 * has no outline to place, and a single-drawing line has no choice to make, so
 * both keep the shipped answer exactly.
 */
async function parentForCut(
  ctx: OperationWriteContext,
  rowId: string,
  vertices: number[][] | undefined,
): Promise<PreconGeometryRow | undefined> {
  const newest = await ctx.geometries.measurementGeometryForRow(rowId);
  if (!newest || !vertices || vertices.length < 3) return newest;
  const drawn = (await ctx.geometries.geometriesByRow(rowId)).filter((g) => g.kind !== "deduction" && !g.deleted_at);
  if (drawn.length <= 1) return newest;
  const cut = vertices.map((v) => [v[0]!, v[1]!] as [number, number]);
  let best = newest;
  let bestArea = 0;
  for (const shape of drawn) {
    const held = overlapArea(shape.vertices.map((v) => [v[0]!, v[1]!] as [number, number]), cut);
    if (held > bestArea) {
      bestArea = held;
      best = shape;
    }
  }
  return best;
}

async function requireDeductionGeometry(
  ctx: OperationWriteContext,
  rowId: string,
  geometryId: string,
): Promise<PreconGeometryRow> {
  const geometry = await ctx.geometries.geometryById(geometryId);
  if (!geometry || geometry.row_id !== rowId || geometry.kind !== "deduction") throw new NotFoundError("Deduction");
  return geometry;
}

async function sheetOfGeometry(
  ctx: OperationWriteContext,
  sessionId: string,
  geometry: PreconGeometryRow,
): Promise<PreconSheetRow> {
  const sheet = await ctx.sheets.sheetById(geometry.sheet_id);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  return sheet;
}

/**
 * The gross the openings come off. Re-added from every shape on the line where it
 * can be, so a multi-shape wall deducts from its whole area; falls back to the
 * stored figure for a legacy line whose shapes record nothing, which is exactly
 * the line a QS is most likely to be repairing.
 */
export async function grossOf(ctx: OperationWriteContext, row: PreconBoqRowRow, sessionId: string): Promise<number> {
  try {
    return (await recomputeRow(ctx, row, sessionId)).gross;
  } catch {
    return num(row.qty_gross) ?? num(row.qty) ?? 0;
  }
}

export interface WriteDeductions {
  ctx: OperationWriteContext;
  sessionId: string;
  row: PreconBoqRowRow;
  version: number;
  next: Deduction[];
  gross: number;
}

export async function commitDeductions({ ctx, row, version, next, gross }: WriteDeductions): Promise<PreconBoqRowRow> {
  const { deficit } = assertRepairsDeficit(gross, row.deductions ?? [], next);
  const typical = row.typical ?? 1;
  const net = netQuantity(gross, next, typical);
  const before = measuredStateOf(row);
  const after = { ...before, qty: net, gross, deductions: next };
  const updated = await ctx.rows.updateRowVersioned(row.id, version, {
    deductions: next,
    qty_gross: gross,
    qty: net,
    measurement_basis: basisFor({ basis: row.measurement_basis, gross, deductions: next, typical, net, unit: row.unit, deficit }),
    amount: amountFor(row, net),
    ...reviewPatchFor(row, before, after),
  });
  if (!updated) throw new ConflictError(STALE);
  return updated;
}

export interface AddDeductionResult extends PreconBoqRowDto {
  geometryId: string;
}

export async function addDeductionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  rowId: string,
  body: AddDeductionBody,
  actor: string,
): Promise<AddDeductionResult> {
  const row = await requireRow(ctx, rowId);
  const parent = await parentForCut(ctx, rowId, body.vertices);
  if (!parent) throw new BadRequestError("Measure this line before taking a deduction off it");
  const sheet = await sheetOfGeometry(ctx, sessionId, parent);
  const parentFactor = tryResolveMeasureTool(parent.definition ?? null)?.factor ?? {};
  const geometryId = generateId("pgeo");

  let entry: Deduction;
  let definition: unknown;
  let vertices: number[][] = [];

  if (body.vertices && body.vertices.length > 0) {
    const tool = deductionToolFor(row.unit);
    // The scale the PARENT was measured at, never the region this cut's own
    // first vertex happens to land in: an opening is a hole in that shape, so
    // measuring it at a different scale nets off a figure that was never there.
    const pick = boundScale(sheet, parent) ?? scaleForTool(sheet, tool, body.vertices);
    const cut = measureDeduction(row.unit, body.vertices, mmPerPtOf(pick), parentFactor, body.mode);
    if (AREA_DEDUCTION_TOOLS.includes(cut.tool)) {
      assertInsideParent(body.vertices, parent.vertices, mmPerPtOf(pick));
      const siblings = (await ctx.geometries.geometriesByRow(rowId))
        .filter((g) => g.kind === "deduction")
        .map((g) => g.vertices ?? []);
      assertNoOverlap(body.vertices, siblings, mmPerPtOf(pick));
    }
    vertices = body.vertices;
    entry = { label: body.label, qty: cut.qty, geometryId, unit: cut.unit, unitConfirmed: true };
    definition = deductionDefinition(parent.id, cut.tool, body.vertices);
  } else {
    const stated = statedCut(body.mode ?? "wall-opening", body.dimensions, row.unit);
    entry = { label: body.label, qty: stated.qty, geometryId, unit: stated.unit, unitConfirmed: true };
    definition = statedDeductionDefinition(parent.id, stated.mode, stated.dimensions);
  }

  const gross = await grossOf(ctx, row, sessionId);
  const next = [...(row.deductions ?? []), entry];
  const updated = await commitDeductions({ ctx, sessionId, row, version: body.version, next, gross });

  await ctx.geometries.insertGeometries([
    {
      id: geometryId,
      row_id: rowId,
      sheet_id: sheet.id,
      kind: "deduction",
      vertices,
      source: "manual",
      quantity: entry.qty,
      unit: entry.unit,
      parent_geometry_id: parent.id,
      definition,
    },
  ]);
  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "deduction_added",
    { qty: num(row.qty) },
    { qty: num(updated.qty), label: entry.label, deducted: entry.qty, unit: entry.unit, geometryId },
    body.operationId,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { qty: num(updated.qty), deductions: next },
  });
  return { ...toRow(updated), geometryId };
}

export async function editDeductionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  rowId: string,
  geometryId: string,
  body: EditDeductionBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  const deductions = row.deductions ?? [];
  const index = deductionIndex(deductions, geometryId);
  const existing = deductions[index]!;

  const geometry = await requireDeductionGeometry(ctx, rowId, geometryId);
  const sheet = await sheetOfGeometry(ctx, sessionId, geometry);
  // The outline this opening was cut out of, as RECORDED. An edit has no choice
  // to make — the opening already names its parent — and reaching for the line's
  // newest drawing instead would re-measure the void against a shape it is not a
  // hole in. Only where nothing was recorded does the shipped fallback apply.
  const parent = geometry.parent_geometry_id
    ? ((await ctx.geometries.geometryById(geometry.parent_geometry_id)) ??
      (await ctx.geometries.measurementGeometryForRow(rowId)))
    : await ctx.geometries.measurementGeometryForRow(rowId);
  const parentFactor = tryResolveMeasureTool(parent?.definition ?? null)?.factor ?? {};

  let entry: Deduction;
  let definition: unknown;
  let vertices = geometry.vertices;

  if (body.vertices && body.vertices.length > 0) {
    const pick = scaleForTool(sheet, deductionToolFor(row.unit), body.vertices);
    const cut = measureDeduction(row.unit, body.vertices, mmPerPtOf(pick), parentFactor, body.mode);
    if (AREA_DEDUCTION_TOOLS.includes(cut.tool) && parent) {
      assertInsideParent(body.vertices, parent.vertices, mmPerPtOf(pick));
      const siblings = (await ctx.geometries.geometriesByRow(rowId))
        .filter((g) => g.kind === "deduction" && g.id !== geometryId)
        .map((g) => g.vertices ?? []);
      assertNoOverlap(body.vertices, siblings, mmPerPtOf(pick));
    }
    vertices = body.vertices;
    entry = { ...existing, qty: cut.qty, unit: cut.unit, unitConfirmed: true };
    definition = parent ? deductionDefinition(parent.id, cut.tool, body.vertices) : null;
  } else {
    const stored = (geometry.definition as { mode?: unknown } | null)?.mode;
    const mode = (typeof stored === "string" ? stored : "wall-opening") as Parameters<typeof statedCut>[0];
    const stated = statedCut(mode, body.dimensions, row.unit);
    entry = { ...existing, qty: stated.qty, unit: stated.unit, unitConfirmed: true };
    definition = parent ? statedDeductionDefinition(parent.id, stated.mode, stated.dimensions) : null;
  }

  const next = [...deductions];
  next[index] = entry;
  const gross = await grossOf(ctx, row, sessionId);
  const updated = await commitDeductions({ ctx, sessionId, row, version: body.version, next, gross });

  await ctx.geometries.updateGeometryMeasurement(geometryId, {
    vertices,
    quantity: entry.qty,
    ...(entry.unit === null ? {} : { unit: entry.unit }),
    definition,
  });
  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "deduction_edited",
    { qty: num(row.qty), deducted: existing.qty, unit: existing.unit },
    { qty: num(updated.qty), deducted: entry.qty, unit: entry.unit, geometryId },
    body.operationId,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { qty: num(updated.qty), deductions: next },
  });
  return toRow(updated);
}

export async function removeDeductionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  rowId: string,
  geometryId: string,
  body: RemoveDeductionBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  const deductions = row.deductions ?? [];
  const index = deductionIndex(deductions, geometryId);
  const withdrawn = deductions[index]!;
  const remaining = deductions.filter((_, i) => i !== index);

  const gross = await grossOf(ctx, row, sessionId);
  const updated = await commitDeductions({ ctx, sessionId, row, version: body.version, next: remaining, gross });

  await ctx.geometries.softDeleteGeometry(geometryId, new Date());
  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "deduction_removed",
    { qty: num(row.qty), label: withdrawn.label, deducted: withdrawn.qty, unit: withdrawn.unit },
    { qty: num(updated.qty), geometryId },
    body.operationId,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { qty: num(updated.qty), deductions: remaining },
  });
  return toRow(updated);
}
