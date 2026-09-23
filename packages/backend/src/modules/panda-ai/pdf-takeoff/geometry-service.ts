import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import { num, toRow } from "./dto.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity, GEOMETRY_KIND_BY_TOOL } from "./measurements.ts";
import { deductionToolFor, measureDeduction, quantityFromRedraw, resolveMeasureTool, tryResolveMeasureTool } from "./measurement-resolve.ts";
import { measurementDefinition, deductionDefinition } from "./measurement-definition.ts";
import { reviewResetPatch } from "./review-policy.ts";
import { mmPerPtOf, scaleClause, scaleForTool } from "./viewports.ts";
import type {
  AddDeductionBody,
  Deduction,
  MeasureFactor,
  MeasureTool,
  PreconBoqRowDto,
  PreconBoqRowRow,
  PreconSheetRow,
  UpdateGeometryBody,
} from "./types.ts";
import type { PublishFn } from "./service.ts";

type Audit = (
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => Promise<void>;

interface Deps {
  repo: PreconRepository;
  audit: Audit;
  publish: PublishFn;
  requireRow: (rowId: string) => Promise<{ row: PreconBoqRowRow; sessionId: string }>;
  resolveMeasurementSheet: (rowId: string, sessionId: string, sheetId?: string) => Promise<PreconSheetRow>;
  isAnchorRow: (row: PreconBoqRowRow) => boolean;
  recomputeDerivedRows: (sessionId: string, actor: string) => Promise<void>;
  assertDerivedFanoutWithinCap: (sessionId: string) => Promise<void>;
}

function factorClause(tool: MeasureTool, factor: MeasureFactor): string {
  if (tool === "wall_area") return ` × ${factor.heightM} m height`;
  if (tool === "volume") return ` × ${factor.depthM} m depth`;
  return "";
}

/**
 * Re-measuring a line on a sheet: the redrawn shape and the deductions taken
 * off it. The quantity is always recomputed server-side from the vertices —
 * with the TOOL that made the line, so a redrawn wall keeps the height that
 * turned its run into an area and a redrawn slab keeps its depth.
 */
export function geometryService({
  repo,
  audit,
  publish,
  requireRow,
  resolveMeasurementSheet,
  isAnchorRow,
  recomputeDerivedRows,
  assertDerivedFanoutWithinCap,
}: Deps) {
  return {
    // Server-side quantity recompute: the client sends vertices, never quantities.
    async updateGeometry(rowId: string, body: UpdateGeometryBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      const existing = await repo.measurementGeometryForRow(rowId);
      // Refuses rather than guesses: a tool it cannot establish would silently
      // re-bill the line at its bare base figure.
      const { tool, factor } = resolveMeasureTool(existing?.definition ?? null);

      const sheet = await resolveMeasurementSheet(rowId, sessionId, body.sheetId);
      const pick = scaleForTool(sheet, tool, body.vertices);
      // validates the shape before anything is written
      const measured = quantityFromRedraw(tool, body.vertices, mmPerPtOf(pick), factor);
      if (row.unit && measured.unit !== row.unit) {
        throw new BadRequestError(
          `This line is billed in ${row.unit}; measuring it as a ${tool.replace("_", " ")} would make it ${measured.unit}. Change the unit on the line first.`,
        );
      }

      const unit = row.unit ?? measured.unit;
      const quantity = measured.quantity;
      const typical = row.typical ?? 1;
      const net = netQuantity(quantity, row.deductions ?? [], typical);
      const head = `Manually re-measured (${tool.replace("_", " ")}); ${measured.base} ${measured.baseUnit}${factorClause(tool, factor)}; gross ${quantity} ${unit}${scaleClause(sheet, pick)}`;
      if (isAnchorRow(row)) await assertDerivedFanoutWithinCap(sessionId);
      const updated = await repo.updateRowVersioned(rowId, body.version, {
        qty_gross: quantity,
        qty: net,
        unit,
        measurement_basis: basisFor({
          basis: head,
          gross: quantity,
          deductions: row.deductions ?? [],
          typical,
          net,
          unit,
        }),
        amount: row.rate !== null ? Math.round(net * Number(row.rate) * 100) / 100 : null,
        ...reviewResetPatch(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and redraw");

      const kind = GEOMETRY_KIND_BY_TOOL[tool];
      await repo.replaceRowGeometry(rowId, {
        id: generateId("pgeo"),
        row_id: rowId,
        sheet_id: sheet.id,
        kind,
        vertices: body.vertices,
        source: "manual",
        quantity,
        unit,
        definition: measurementDefinition(tool, body.vertices, factor, sheet, pick),
      });
      await audit(sessionId, rowId, actor, "measured", { qty: num(row.qty) }, { qty: net, gross: quantity, tool });
      publish(sessionId, {
        type: "geometry.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { qty: net, qtyGross: quantity },
      });
      if (isAnchorRow(updated)) await recomputeDerivedRows(sessionId, actor);
      return toRow(updated);
    },

    async addDeduction(rowId: string, body: AddDeductionBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      const parent = await repo.measurementGeometryForRow(rowId);
      // A volume is netted off in m3, so the parent's depth has to travel with
      // it; for every other unit the deduction needs no factor at all.
      const parentFactor =
        tryResolveMeasureTool(parent?.definition ?? null)?.factor ?? {};

      const sheet = await resolveMeasurementSheet(rowId, sessionId, body.sheetId);
      if (!body.vertices || body.vertices.length === 0) {
        throw new BadRequestError("Take stated openings through the editor operation endpoint, which records their dimensions");
      }
      const pick = scaleForTool(sheet, deductionToolFor(row.unit), body.vertices);
      // validates the shape and the dimension before anything is written
      const cut = measureDeduction(row.unit, body.vertices, mmPerPtOf(pick), parentFactor, body.mode);

      const geometryId = generateId("pgeo");
      const label = `${body.label}${scaleClause(sheet, pick)}`;
      const deductions: Deduction[] = [
        ...(row.deductions ?? []),
        // the unit is the parent's own, checked not assumed
        { label, qty: cut.qty, geometryId, unit: cut.unit, unitConfirmed: true },
      ];
      const gross = num(row.qty_gross) ?? num(row.qty) ?? 0;
      const net = netQuantity(gross, deductions, row.typical ?? 1);
      const updated = await repo.updateRowVersioned(rowId, body.version, {
        deductions,
        qty: net,
        amount: row.rate !== null ? Math.round(net * Number(row.rate) * 100) / 100 : null,
        ...reviewResetPatch(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and retry");
      await repo.insertGeometries([
        {
          id: geometryId,
          row_id: rowId,
          sheet_id: sheet.id,
          kind: "deduction",
          vertices: body.vertices,
          source: "manual",
          quantity: cut.qty,
          unit: cut.unit,
          parent_geometry_id: parent?.id ?? null,
          definition: parent ? deductionDefinition(parent.id, cut.tool, body.vertices) : null,
        },
      ]);
      await audit(sessionId, rowId, actor, "deduction_added", { qty: num(row.qty) }, { label: body.label, qty: cut.qty, unit: cut.unit });
      publish(sessionId, {
        type: "geometry.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { qty: net, deductions },
      });
      return toRow(updated);
    },
  };
}
