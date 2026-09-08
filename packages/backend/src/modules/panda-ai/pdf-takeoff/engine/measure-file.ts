import type { CalibrationResult, MeasuredBoqItem, SheetKind } from "../types.ts";
import { calibrate } from "./calibrate.ts";
import { countDoorArcs } from "./measure.ts";
import { classifySheet, measureSheetRegions } from "./measure-sheet.ts";
import { extractSheet } from "./pdf-extract.ts";

// The per-sheet measuring path with no database and no queue: open a PDF from
// disk, and for every page run extraction, calibration, classification and
// measurement exactly as generateForSession does. Used by the benchmark and
// handy for reproducing a sheet's result from the command line.

export interface MeasuredPage {
  pageNumber: number;
  segments: number;
  texts: number;
  kind: SheetKind;
  title: string | null;
  calibration: CalibrationResult | null;
  items: MeasuredBoqItem[];
  note: string | null;
}

export async function measurePdfFile(filePath: string, opts: { roomsAsItems?: boolean } = {}): Promise<MeasuredPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ url: filePath, useSystemFonts: true }).promise;
  const pages: MeasuredPage[] = [];
  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const extracted = await extractSheet(page as never, pdfjs.OPS as never);
      const base = { pageNumber: pageNo, segments: extracted.segments.length, texts: extracted.texts.length };
      if (extracted.segments.length < 100) {
        pages.push({ ...base, kind: "unknown", title: null, calibration: null, items: [], note: "fewer than 100 segments: the session path would try vision here" });
        continue;
      }
      const calibration = calibrate(extracted.texts, extracted.segments);
      const doorProbe = countDoorArcs(extracted.curves, calibration?.mmPerPt ?? 17.68);
      const { kind, title } = classifySheet(
        extracted.texts,
        doorProbe.count > 0,
        /bed\s*room|kitchen|living|lounge/i.test(extracted.texts.map((t) => t.str).join(" ")),
      );
      if (!calibration) {
        pages.push({ ...base, kind, title, calibration: null, items: [], note: "no reliable scale" });
        continue;
      }
      if (kind !== "floor-plan") {
        pages.push({ ...base, kind, title, calibration, items: [], note: `classified as ${kind}; not measured` });
        continue;
      }
      const measured = measureSheetRegions(extracted, calibration.mmPerPt, calibration.confidence, pageNo, `page ${pageNo}`, opts.roomsAsItems ?? false);
      const items =
        calibration.confidence < 0.7
          ? measured.items.map((i) => ({ ...i, confidence: "low" as const, confidenceReason: "scale" }))
          : measured.items;
      pages.push({ ...base, kind, title, calibration, items, note: null });
    }
  } finally {
    await doc.cleanup();
  }
  return pages;
}
