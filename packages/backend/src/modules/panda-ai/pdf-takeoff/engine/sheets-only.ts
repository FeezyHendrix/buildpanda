import type { Knex } from "knex";
import { generateId } from "../../../../lib/ids.ts";
import { preconRepository } from "../repository.ts";
import type { PreconSheetRow } from "../types.ts";
import { buildSnapIndex } from "./pdf-extract.ts";
import { extractAllPages } from "./measure-file.ts";
import { fromPdf } from "../../geometry/from-pdf.ts";
import { buildReport, summarise } from "../../geometry/report.ts";
import type { ExtractionReport } from "../../geometry/types.ts";
import { calibrate } from "./calibrate.ts";
import { countDoorArcs } from "./measure.ts";
import { classifySheet, withTempFile } from "./measure-sheet.ts";
import type { ProgressFn } from "./run.ts";

// A take-off measured by hand needs what the viewer needs and nothing more:
// one sheet per PDF page, its snap index, the scale read off its dimension
// text, and a title. No regions are measured and no bill is drafted — the
// person drawing on the sheet does that.

const NO_SCALE = "No reliable scale — set one by typing it or drawing a known dimension";

export async function renderSheetsOnly(db: Knex, sessionId: string, progress: ProgressFn = () => {}): Promise<{ sheets: number }> {
  const repo = preconRepository(db);
  const placeholders = await repo.sheetsBySession(sessionId);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const extractionBySheet: Record<string, ExtractionReport> = {};
  let nextPageNumber = 1;
  let ready = 0;

  for (const placeholder of placeholders) {
    if (!/\.pdf$/i.test(placeholder.file_name)) {
      await repo.updateSheetStatus(placeholder.id, "unmeasurable", "Only PDF pages render here; a DWG is read by the DWG take-off");
      continue;
    }
    try {
      await withTempFile(placeholder.storage_path, "pdf", async (file) => {
        const doc = await pdfjs.getDocument({ url: file, useSystemFonts: true }).promise;
        await progress("reading", `Rendering ${placeholder.file_name} (${doc.numPages} pages)`, { pages: doc.numPages });
        const pages = await extractAllPages(doc, pdfjs.OPS);
        for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
          const globalPage = nextPageNumber++;
          // the placeholder row is page 1; every further page gets its own row
          const sheetId = pageNo === 1 ? placeholder.id : generateId("pcsh");
          if (pageNo !== 1) {
            const row: Omit<PreconSheetRow, "created_at" | "updated_at"> = {
              id: sheetId,
              session_id: sessionId,
              file_name: placeholder.file_name,
              storage_path: placeholder.storage_path,
              page_number: globalPage,
              code: null,
              title: null,
              kind: "unknown",
              status: "pending",
              scale_mm_per_pt: null,
              scale_confidence: null,
              dim_unit: null,
              snap_index: null,
              geo_summary: null,
              error: null,
            };
            await repo.insertSheets([row]);
          }
          try {
            const extracted = pages[pageNo - 1]!.extracted;
            const report = buildReport(fromPdf(extracted, extracted.ops, pdfjs.OPS as never));
            extractionBySheet[sheetId] = report;
            await repo.updateSheetGeoSummary(sheetId, summarise(report));
            const calibration = calibrate(extracted.texts, extracted.segments);
            const doorProbe = countDoorArcs(extracted.curves, calibration?.mmPerPt ?? 17.68);
            const { kind, title } = classifySheet(
              extracted.texts,
              doorProbe.count > 0,
              /bed\s*room|kitchen|living|lounge/i.test(extracted.texts.map((t) => t.str).join(" ")),
            );
            const code = `SHT-${String(globalPage).padStart(2, "0")}`;
            await repo.updateSheet(sheetId, {
              code,
              title: title ?? placeholder.file_name,
              kind,
              // "measured" here means the sheet is open for drawing; without a
              // scale it waits for one, like a sheet the engine could not read
              status: calibration ? "measured" : "unmeasurable",
              page_number: globalPage,
              scale_mm_per_pt: calibration?.mmPerPt ?? null,
              scale_confidence: calibration?.confidence ?? null,
              dim_unit: calibration?.dimUnit ?? null,
              snap_index: buildSnapIndex(extracted.segments),
              error: calibration ? null : NO_SCALE,
            });
            ready += 1;
            await progress(
              "reading",
              calibration
                ? `${code} ready at 1:${Math.round(calibration.mmPerPt / 0.3528)}`
                : `${code} rendered; set its scale before measuring`,
              { sheetId },
            );
          } catch (pageError) {
            const message = pageError instanceof Error ? pageError.message : "Page could not be rendered";
            await repo.updateSheetStatus(sheetId, "unmeasurable", message);
          }
        }
        await doc.cleanup();
      });
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : "File processing failed";
      await repo.updateSheetStatus(placeholder.id, "unmeasurable", message);
    }
  }

  if (Object.keys(extractionBySheet).length > 0) {
    await repo.updateSessionExtraction(sessionId, { sheets: extractionBySheet, generatedAt: new Date().toISOString() });
  }
  return { sheets: ready };
}
