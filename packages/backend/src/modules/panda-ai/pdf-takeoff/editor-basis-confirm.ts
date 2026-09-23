// Stating what an unclassified shape was always measured as.
//
// A shape imported or drafted before definitions existed carries a bare list of
// points and a figure. Nothing on it says whether that figure is a run, an area
// or a wall taken at a height, nor which scale produced it. The server refuses
// to re-measure such a line at all — a re-calibration is blocked by it, and an
// edit is refused — because every available guess is wrong in a way that does
// not fail: it returns a smaller number on a priced line that still looks
// measured.
//
// The only safe way past that is for a person to state the basis against the
// saved one, which is what this records. It is deliberately NOT a recalculation
// request: where the figure the stated basis reproduces matches what was saved,
// the line keeps its sign-off and only gains a record of what it meant
// (contract 22). Where it does not, the figure moves and the line goes back for
// review — the same rule any other quantity-changing edit follows.
//
// A shape that already records its basis is refused rather than overwritten:
// silently restating one is how a signed-off measurement acquires a basis
// nobody chose.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num } from "./dto.ts";
import { pickScaleForNew } from "./editor-scale-binding.ts";
import { amountFor, recomputeRow } from "./editor-row-recompute.ts";
import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-write-helpers.ts";
import type { ConfirmMeasurementBasisCommand } from "./editor-operation-types.ts";
import { measurementDefinition } from "./measurement-definition.ts";
import { tryResolveMeasureTool } from "./measurement-resolve.ts";
import { basisFor } from "./measurement-basis.ts";
import { measureVertices } from "./measurements.ts";
import { reviewResetPatch } from "./review-policy.ts";
import { mmPerPtOf, scaleClause } from "./viewports.ts";
import type { MeasureFactor, MeasureTool, PreconGeometryRow } from "./types.ts";

export interface BasisConfirmation {
  rowId: string;
  geometryId: string;
  version: number;
  gross: number;
  qty: number;
  unit: string;
  /** True when the stated basis moves the figure, which sends the line back for review. */
  restated: boolean;
}

const FACTOR_REQUIRED: Partial<Record<MeasureTool, keyof MeasureFactor>> = {
  wall_area: "heightM",
  volume: "depthM",
};

function assertFactorStated(tool: MeasureTool, factor: MeasureFactor): void {
  const needed = FACTOR_REQUIRED[tool];
  if (!needed) return;
  const value = factor[needed];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestError(
      `Measuring this as a ${tool.replace("_", " ")} needs the ${needed === "heightM" ? "height" : "depth"} it was taken at. ` +
        "State it against the saved basis rather than leaving it to be inferred.",
    );
  }
}

async function requireUnclassified(
  ctx: EditorWriteContext,
  rowId: string,
  geometryId: string,
): Promise<PreconGeometryRow> {
  const geometry = await ctx.geometries.geometryById(geometryId);
  if (!geometry || geometry.deleted_at || geometry.row_id !== rowId) throw new NotFoundError("Measurement");
  if (geometry.kind === "deduction") {
    throw new BadRequestError("An opening's basis is stated by editing the opening, not the measurement it is cut from");
  }
  if (tryResolveMeasureTool(geometry.definition ?? null)) {
    throw new ConflictError(
      "This measurement already records how it was taken. Correct it through an edit, which is versioned and reviewable, " +
        "rather than restating its basis.",
    );
  }
  return geometry;
}

export async function confirmMeasurementBasisIn(
  ctx: EditorWriteContext,
  sessionId: string,
  command: ConfirmMeasurementBasisCommand,
  actor: string,
): Promise<BasisConfirmation> {
  const row = await requireRow(ctx, command.rowId);
  const geometry = await requireUnclassified(ctx, command.rowId, command.geometryId);
  const sheet = await ctx.sheets.sheetById(geometry.sheet_id);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");

  const factor: MeasureFactor = command.factor ?? {};
  assertFactorStated(command.tool, factor);
  const pick = pickScaleForNew(sheet, command.tool, geometry.vertices, command.scaleChoice);
  const measured = measureVertices(command.tool, geometry.vertices, mmPerPtOf(pick), factor);

  const stated = command.unit?.trim();
  if (stated && stated !== measured.unit) {
    throw new BadRequestError(
      `Measured as a ${command.tool.replace("_", " ")} this is ${measured.unit}, not ${stated}. ` +
        "State the basis the saved figure was taken on, or change the unit on the line first.",
    );
  }
  if (row.unit !== null && row.unit !== measured.unit) {
    throw new BadRequestError(
      `This line is billed in ${row.unit}; measuring it as a ${command.tool.replace("_", " ")} would make it ${measured.unit}. ` +
        "Change the unit on the line first.",
    );
  }

  await ctx.geometries.updateGeometryMeasurement(geometry.id, {
    quantity: measured.base,
    unit: measured.baseUnit,
    definition: measurementDefinition(command.tool, geometry.vertices, factor, sheet, pick),
  });

  const recomputed = await recomputeRow(ctx, row, sessionId);
  const typical = row.typical ?? 1;
  // Contract 22: a basis that reproduces the saved figure is metadata, not a new
  // measurement, so it neither clears the verifier's name nor restates the bill.
  const restated = recomputed.gross !== num(row.qty_gross) || recomputed.net !== num(row.qty);
  const head =
    `Basis stated by ${actor} (${command.tool.replace("_", " ")}); ${recomputed.contributions.length} measurement` +
    `${recomputed.contributions.length === 1 ? "" : "s"}; gross ${recomputed.gross} ${recomputed.unit}${scaleClause(sheet, pick)}`;

  const updated = await ctx.rows.updateRowVersioned(command.rowId, row.version, {
    qty_gross: recomputed.gross,
    qty: recomputed.net,
    unit: recomputed.unit,
    amount: amountFor(row, recomputed.net),
    measurement_basis: basisFor({
      basis: head,
      gross: recomputed.gross,
      deductions: row.deductions ?? [],
      typical,
      net: recomputed.net,
      unit: recomputed.unit,
    }),
    ...(restated ? reviewResetPatch() : {}),
  });
  if (!updated) throw new ConflictError("This line changed while its basis was being stated; refresh and try again");

  await record(
    ctx,
    sessionId,
    command.rowId,
    actor,
    "measurement_basis_confirmed",
    {
      geometryId: geometry.id,
      definition: geometry.definition ?? null,
      quantity: num(geometry.quantity),
      unit: geometry.unit,
      qtyGross: num(row.qty_gross),
      qty: num(row.qty),
      rowUnit: row.unit,
      status: row.status,
      verifiedBy: row.verified_by,
      measurementBasis: row.measurement_basis,
      version: row.version,
    },
    {
      geometryId: geometry.id,
      tool: command.tool,
      factor,
      scale: pick === null ? null : { mmPerPt: pick.mmPerPt, viewportId: pick.viewport?.id ?? null },
      qtyGross: recomputed.gross,
      qty: recomputed.net,
      rowUnit: recomputed.unit,
      status: updated.status,
      version: updated.version,
      restated,
    },
  );

  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: updated.id,
    version: updated.version,
    actor,
    changes: { qty: recomputed.net, qtyGross: recomputed.gross },
  });

  return {
    rowId: updated.id,
    geometryId: geometry.id,
    version: updated.version,
    gross: recomputed.gross,
    qty: recomputed.net,
    unit: recomputed.unit,
    restated,
  };
}
