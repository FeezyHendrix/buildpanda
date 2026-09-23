// What a DWG re-run actually writes, as one unit of work.
//
// Split out of `review-service.ts` at the house 400-line ceiling when the
// re-run became transactional: the service still owns the decision (which
// re-run is this, may it land at all), this owns the write.
//
// Every call here goes through the repository it is HANDED, which is bound to
// the caller's transaction. Reaching for a pool-bound repository from inside
// would put half the re-run outside the lock and outside the rollback, which is
// the split write the whole change exists to remove.

import { generateId } from "../../../lib/ids.ts";
import { NotFoundError } from "../../../lib/errors.ts";
import { dwgGeometryRows } from "./dwg-geometry.ts";
import { planRegisterSheets, replaceableRowIds } from "./dwg-rerun.ts";
import { dwgRow } from "./dwg-row.ts";
import type { PreconRepository } from "./repository.ts";
import type {
  DwgTakeoffHandover,
  DwgTakeoffLine,
  PreconBoqRowRow,
  PreconGeometryRow,
  PreconSessionRow,
} from "./types.ts";

export interface FillDwgOptions {
  sheetsOnly?: boolean;
}

/**
 * Prune the engine's own untouched drafts, rewrite the drawing register onto
 * the sheet ids already spoken for, and draft the new lines.
 *
 * The prune is read INSIDE the unit of work, never carried in from before the
 * drawing was read: a QS who corrected a line while the engine was running has
 * corrected it, and a list computed ten minutes ago would delete it anyway.
 */
export async function fillDwgIn(
  repo: PreconRepository,
  sessionId: string,
  file: { fileName: string },
  handover: DwgTakeoffHandover,
  opts: FillDwgOptions = {},
): Promise<PreconSessionRow> {
  const session = await repo.sessionById(sessionId);
  if (!session) throw new NotFoundError("Preconstruction session");
  const before = await repo.sheetsBySession(session.id);
  const storagePath = before[0]?.storage_path ?? "";
  const [existing, manualEvidence] = await Promise.all([
    repo.rowsBySession(session.id),
    repo.rowIdsWithManualEvidence(session.id),
  ]);
  // Only the engine's own untouched drafts go. The annotations it drew for
  // them go with them through the row CASCADE, so a line a person kept
  // keeps the shape that justifies its figure.
  await repo.deleteRows(replaceableRowIds(existing, new Set(manualEvidence)));
  // Read after the prune: a sheet is only safe to drop once nothing that
  // survived it still stands on it.
  const survivingIds = new Set(await repo.sheetsWithSurvivingEvidence(session.id));
  await repo.deleteSheetsBySessionExcept(session.id, [...survivingIds]);

  const sheetsOnly = Boolean(opts.sheetsOnly);
  const plan = planRegisterSheets({
    sessionId: session.id,
    fileName: file.fileName,
    storagePath,
    units: handover.units,
    sheets: handover.sheets,
    sheetsOnly,
    existing: before,
    survivingIds,
  });
  const sheetIds = plan.idBySourceId;
  await repo.insertSheets(plan.insert);
  // bounded by the drawing register, and each drawing takes a different reading
  await Promise.all(plan.restate.map((s) => repo.restateSheet(s.id, s.patch)));
  await repo.updateSessionLayerMap(session.id, handover.layerMap);

  if (sheetsOnly) {
    await repo.appendSessionProgress(session.id, {
      at: new Date().toISOString(),
      phase: "draft",
      message: `Read ${handover.sheets.length} drawings from ${file.fileName} (${handover.units.note}) — ready to measure by hand`,
    });
    await repo.updateSessionStatus(session.id, "reviewing");
    return (await repo.sessionById(session.id)) ?? { ...session, status: "reviewing" };
  }

  const bills = await repo.billsBySession(session.id);
  const bill =
    bills[0] ??
    (await repo.insertBill({ id: generateId("pbl"), session_id: session.id, title: "Bill No. 1 — Automated take-off (DWG)", sort: 0 }));
  const rows: Omit<PreconBoqRowRow, "created_at" | "updated_at">[] = [];
  const geometries: Omit<PreconGeometryRow, "created_at">[] = [];
  const byTrade = new Map<string, DwgTakeoffLine[]>();
  for (const line of handover.items) {
    const list = byTrade.get(line.trade);
    if (list) list.push(line);
    else byTrade.set(line.trade, [line]);
  }
  const codeOf = (line: DwgTakeoffLine) => handover.sheets.find((s) => s.id === line.sheetId)?.code ?? null;
  for (const [trade, tradeLines] of byTrade) {
    rows.push(dwgRow(bill.id, rows.length, { row_type: "heading", element_group: trade, description: trade.toUpperCase() }));
    for (const line of tradeLines) {
      const low = line.confidence !== "high";
      const code = codeOf(line);
      const row = dwgRow(bill.id, rows.length, {
        // a note-only line is evidence for a priced line, never a quantity of its own
        row_type: line.noteOnly ? "spec_note" : "item",
        element_group: trade,
        code,
        description: line.noteOnly ? `${line.description} (cross-check only: ${line.quantity} ${line.unit})` : line.description,
        unit: line.unit,
        qty_gross: line.noteOnly ? null : line.quantity,
        qty: line.noteOnly ? null : line.quantity,
        confidence: low ? "low" : "high",
        status: low ? "needs_review" : "ai_generated",
        measurement_basis: line.basis,
        // the row's confidence enum has no "medium", so the reason keeps that word
        confidence_reason: [line.confidence === "medium" ? "medium confidence" : null, line.reason, line.crossCheck]
          .filter(Boolean)
          .join(" · "),
        provenance: `Read from ${file.fileName}${code ? ` (${code})` : ""} by the automated take-off: ${line.basis}`,
        evidence: line.evidence ?? [],
      });
      rows.push(row);
      // what the line looks like on the drawing: a note-only line is
      // evidence for another line and marks nothing of its own
      const sheetId = line.sheetId === undefined ? undefined : sheetIds.get(line.sheetId);
      if (!line.noteOnly && sheetId) {
        geometries.push(...dwgGeometryRows(row.id, sheetId, line.shapes, handover.units.scaleToMm));
      }
    }
  }
  if (handover.notes.length) {
    rows.push(dwgRow(bill.id, rows.length, { row_type: "heading", element_group: "notes", description: "ENGINE NOTES" }));
    for (const note of handover.notes) {
      rows.push(dwgRow(bill.id, rows.length, { row_type: "spec_note", element_group: "notes", description: note, status: "needs_review", confidence: "low" }));
    }
  }
  await repo.insertBoqRows(rows);
  await repo.insertGeometries(geometries);
  await repo.appendSessionProgress(session.id, {
    at: new Date().toISOString(),
    phase: "draft",
    message: `Read ${handover.sheets.length} drawings and ${handover.items.length} lines from ${file.fileName} (${handover.units.note})`,
  });
  await repo.updateSessionStatus(session.id, "reviewing");
  return (await repo.sessionById(session.id)) ?? { ...session, status: "reviewing" };
}
