import type { Knex } from "knex";
import { generateId } from "../../../../lib/ids.ts";
import { NotFoundError, BadRequestError } from "../../../../lib/errors.ts";
import { preconRepository } from "../repository.ts";
import type { DimUnit, MeasuredBoqItem, PreconBillRow } from "../types.ts";
import { extractSheet, buildSnapIndex } from "./pdf-extract.ts";
import { fromPdf } from "../../geometry/from-pdf.ts";
import { buildReport, summarise } from "../../geometry/report.ts";
import { calibrate } from "./calibrate.ts";
import { countDoorArcs } from "./measure.ts";
import { classifySheet, measureSheetRegions, withTempFile } from "./measure-sheet.ts";
import { draftBoq } from "./boq-draft.ts";
import type { ProgressFn } from "./run.ts";

interface Calibration {
  mmPerPt: number;
  confidence: number;
  dimUnit: DimUnit;
}

// The measured-works bill is where re-measured and redrafted lines land. A
// session always has one after generate; a hand-built one may not.
export async function measuredBillFor(
  repo: ReturnType<typeof preconRepository>,
  sessionId: string,
): Promise<PreconBillRow> {
  const bills = await repo.billsBySession(sessionId);
  const existing = bills.find((b) => /measured/i.test(b.title)) ?? bills[bills.length - 1];
  if (existing) return existing;
  return repo.insertBill({
    id: generateId("pbl"),
    session_id: sessionId,
    title: "Bill No. 2 — Measured works",
    sort: await repo.nextBillSort(sessionId),
  });
}

/**
 * Re-read one sheet after a reviewer changed its type or scale. Replaces the
 * sheet's unverified AI lines; verified and hand-entered lines are untouched.
 */
export async function remeasureSheet(db: Knex, sheetId: string, progress: ProgressFn = () => {}): Promise<{ lines: number }> {
  const repo = preconRepository(db);
  const sheet = await repo.sheetById(sheetId);
  if (!sheet) throw new NotFoundError("Sheet");
  if (!/\.pdf$/i.test(sheet.file_name)) throw new BadRequestError("Only PDF sheets can be re-measured");
  const session = await repo.sessionById(sheet.session_id);
  const sheets = await repo.sheetsBySession(sheet.session_id);
  const siblings = sheets.filter((s) => s.storage_path === sheet.storage_path).sort((a, b) => a.page_number - b.page_number);
  const pageNo = siblings.findIndex((s) => s.id === sheetId) + 1;
  const label = `${sheet.file_name} p${pageNo}`;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  await progress("reading", `Re-reading ${label}`);
  const items = await withTempFile(sheet.storage_path, "pdf", async (file): Promise<MeasuredBoqItem[]> => {
    const doc = await pdfjs.getDocument({ url: file, useSystemFonts: true }).promise;
    const page = await doc.getPage(pageNo);
    const extracted = await extractSheet(page as never, pdfjs.OPS as never);
    await doc.cleanup();
    await repo.updateSheetGeoSummary(sheetId, summarise(buildReport(fromPdf(extracted, extracted.ops, pdfjs.OPS as never))));
    // a scale the reviewer typed or drew (confidence 1) beats the engine's guess
    const userScale: Calibration | null =
      sheet.scale_confidence === 1 && sheet.scale_mm_per_pt
        ? { mmPerPt: sheet.scale_mm_per_pt, confidence: 1, dimUnit: sheet.dim_unit ?? "mm" }
        : null;
    const calibration: Calibration | null = userScale ?? calibrate(extracted.texts, extracted.segments);
    const doorProbe = countDoorArcs(extracted.curves, calibration?.mmPerPt ?? 17.68);
    const classified = classifySheet(
      extracted.texts,
      doorProbe.count > 0,
      /bed\s*room|kitchen|living|lounge/i.test(extracted.texts.map((t) => t.str).join(" ")),
    );
    const kind = sheet.kind !== "unknown" ? sheet.kind : classified.kind;
    const title = sheet.title ?? classified.title;
    await repo.updateSheet(sheetId, {
      kind,
      title,
      status: calibration ? "measured" : "unmeasurable",
      scale_mm_per_pt: calibration?.mmPerPt ?? null,
      scale_confidence: calibration?.confidence ?? null,
      dim_unit: calibration?.dimUnit ?? null,
      snap_index: buildSnapIndex(extracted.segments),
      error: calibration ? null : "No reliable scale — set one by typing it or drawing a known dimension",
    });
    if (!calibration || kind !== "floor-plan") return [];
    const measured = measureSheetRegions(
      extracted,
      calibration.mmPerPt,
      calibration.confidence,
      sheet.page_number,
      label,
      session?.scope?.kind === "areas",
    );
    return calibration.confidence < 0.7
      ? measured.items.map((i) => ({ ...i, confidence: "low" as const, confidenceReason: "scale" }))
      : measured.items;
  });

  const stale = await repo.aiRowIdsOnSheet(sheetId);
  await repo.deleteRows(stale);
  const bill = await measuredBillFor(repo, sheet.session_id);
  const drafted = draftBoq(
    sheet.session_id,
    items,
    new Map([[sheet.page_number, sheetId]]),
    new Map([[sheet.page_number, sheet.code ?? `p${sheet.page_number}`]]),
  );
  const draftedBillId = drafted.bills[1]!.id;
  const start = await repo.nextRowSort(bill.id);
  const rows = drafted.rows
    .filter((r) => r.bill_id === draftedBillId)
    .map((r, i) => ({ ...r, bill_id: bill.id, sort: start + i }));
  await repo.insertBoqRows(rows);
  await repo.insertGeometries(drafted.geometries);
  await progress("draft", `Re-measured ${label}: ${items.length} lines replaced ${stale.length}`);
  return { lines: items.length };
}
