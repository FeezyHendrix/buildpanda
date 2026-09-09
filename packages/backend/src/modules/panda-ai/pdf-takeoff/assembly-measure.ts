import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import type { PricedAssembly } from "../../rate-library/types.ts";
import type { PreconRepository } from "./repository.ts";
import type { manualService } from "./manual-service.ts";
import { applyTypical, measureVertices, normaliseTypical } from "./measurements.ts";
import { scaleAt, scaleClause } from "./viewports.ts";
import type { AssemblyMeasurementResult, CreateAssemblyMeasurementBody, ManualQuantity, MeasureTool, PreconGeometryRow } from "./types.ts";

interface Deps {
  repo: PreconRepository;
  // the hand-drawn line's bill lookup, insert, audit and announcement
  manual: ReturnType<typeof manualService>["manualLine"];
  loadAssembly: (orgId: string, assemblyId: string) => Promise<PricedAssembly>;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

// "m²" and "M2" are the same unit to a QS; the comparison should agree.
const unitKey = (unit: string): string =>
  unit.trim().toLowerCase().replace("²", "2").replace("³", "3").replace(/\s+/g, "").replace(/^sqm$/, "m2").replace(/^cum$/, "m3").replace(/^no\.?$/, "nr");

/** The assembly is measured in one unit; a drawing that yields another cannot feed its factors. */
export function assertAssemblyUnit(assembly: { name: string; unit: string }, q: ManualQuantity, tool: MeasureTool): void {
  if (unitKey(assembly.unit) === unitKey(q.unit)) return;
  throw new BadRequestError(`${assembly.name} is measured in ${assembly.unit}; a ${tool.replace("_", " ")} gives ${q.unit}`);
}

/** "12.4 m polyline on DWG-01 × factor 2.7 (Blockwall 225: Plaster both sides) × 2 typical floors = 66.96 m2" */
export function assemblyBasis(
  measured: string,
  assembly: { name: string },
  item: { description: string; factor: number; unit: string },
  typical: number,
  qty: number,
): string {
  const parts = [measured, `× factor ${item.factor} (${assembly.name}: ${item.description})`];
  if (typical > 1) parts.push(`× ${typical} typical floors`);
  return `${parts.join(" ")} = ${qty} ${item.unit}`;
}

/**
 * One drawn shape, billed as every item of an assembly. The drawing is
 * measured once (the same maths as a hand-drawn line); each item then gets
 * its own verified line at drawn × factor (× typical), its own unit, its
 * library rate, and a copy of the shape as evidence, so any line can be
 * checked, deducted from or redrawn on its own.
 */
export function assemblyMeasurement({ repo, manual, loadAssembly }: Deps) {
  return {
    async create(sessionId: string, orgId: string, body: CreateAssemblyMeasurementBody, actor: string): Promise<AssemblyMeasurementResult> {
      const assembly = await loadAssembly(orgId, body.assemblyId);
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const sheet = await repo.sheetById(body.sheetId);
      if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
      if (!sheet.scale_mm_per_pt) throw new BadRequestError("Set the sheet scale first");
      const typical = normaliseTypical(body.typical);
      // the viewport under the first vertex sets the scale, else the sheet does
      const pick = scaleAt(sheet, body.vertices);
      const q = measureVertices(body.tool, body.vertices, pick.mmPerPt, body.factor);
      assertAssemblyUnit(assembly, q, body.tool);
      const sheetCode = sheet.code ?? sheet.title ?? sheet.file_name;
      const measured = `${q.gross} ${q.unit} ${body.tool.replace("_", " ")} on ${sheetCode}${scaleClause(sheet, pick)}`;
      const bill = await manual.targetBill(sessionId, body.billId);

      const rows = [];
      const geometries: Omit<PreconGeometryRow, "created_at">[] = [];
      for (const item of assembly.items) {
        const gross = round2(q.gross * item.factor);
        const qty = applyTypical(gross, typical);
        const rate = item.rate ?? body.rate;
        const row = await manual.insert(
          bill,
          {
            description: item.description,
            elementGroup: item.elementGroup || body.elementGroup || assembly.elementGroup,
            code: item.code ?? undefined,
            unit: item.unit,
            gross,
            typical,
            rate,
            basis: assemblyBasis(measured, assembly, item, typical, qty),
            provenance: `Measured by hand on ${sheetCode} by ${actor} (assembly: ${assembly.name})`,
          },
          actor,
        );
        rows.push(row);
        geometries.push({
          id: generateId("pgeo"),
          row_id: row.id,
          sheet_id: sheet.id,
          kind: q.geometryKind,
          vertices: body.vertices,
          source: "manual",
          quantity: q.base,
          unit: q.baseUnit,
        });
      }
      await repo.insertGeometries(geometries);
      for (const row of rows) {
        await manual.audit(sessionId, row.id, actor, "measured_by_hand", null, {
          tool: body.tool,
          sheetId: sheet.id,
          assemblyId: assembly.id,
          qty: Number(row.qty),
          unit: row.unit,
          typical,
          basis: row.measurement_basis,
        });
        manual.announce(sessionId, row, actor, { tool: body.tool, sheetId: sheet.id, assemblyId: assembly.id });
      }
      const created = new Date();
      const dtos = geometries.map((g) => manual.toGeometry({ ...g, created_at: created }));
      return { rows: rows.map(manual.toRow), geometry: dtos[0]!, geometries: dtos };
    },
  };
}
