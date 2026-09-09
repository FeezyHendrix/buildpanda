import type { CalibrationResult, ExtractedSheet, MeasuredBoqItem, SheetKind } from "../types.ts";
import { calibrate } from "./calibrate.ts";
import { buildDocumentContext, type DocumentContext } from "./document-context.ts";
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

export interface ExtractedPage {
  pageNumber: number;
  extracted: ExtractedSheet;
  calibration: CalibrationResult | null;
}

interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<unknown>;
}

// Read every page once so the document-wide facts (level marks, elevation
// window heights) are known before any plan is measured.
export async function extractAllPages(doc: PdfDocumentLike, OPS: unknown): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const extracted = await extractSheet(page as never, OPS as never);
    const calibration = extracted.segments.length >= 100 ? calibrate(extracted.texts, extracted.segments) : null;
    pages.push({ pageNumber: pageNo, extracted, calibration });
  }
  return pages;
}

export function contextFromPages(pages: ExtractedPage[]): DocumentContext {
  return buildDocumentContext(pages.map((p) => ({ texts: p.extracted.texts, segments: p.extracted.segments, mmPerPt: p.calibration?.mmPerPt ?? null })));
}

export function hasRoomWords(extracted: ExtractedSheet): boolean {
  return /bed\s*room|kitchen|living|lounge/i.test(extracted.texts.map((t) => t.str).join(" "));
}

// an image covering this much of the page is the drawing itself, not a logo
const RASTER_PAGE_SHARE = 0.2;

/**
 * A page whose drawing is an embedded image is pixels: the vector engine
 * cannot measure it and says so, instead of measuring the title block.
 */
export function rasterNote(extracted: ExtractedSheet): string | null {
  const img = extracted.images;
  if (!img || img.count === 0) return null;
  const share = img.pageShare;
  if (share !== null && share < RASTER_PAGE_SHARE) return null;
  if (share === null && extracted.segments.length >= 100) return null;
  const pct = share === null ? "" : ` covering ${Math.round(share * 100)}% of the page`;
  return `raster drawing: ${img.count} embedded image${img.count > 1 ? "s" : ""}${pct} with ${extracted.segments.length} vector lines around it; the plan is pixels and cannot be measured from vectors — unmeasurable here, needs vision or a CAD export`;
}

export async function measurePdfFile(filePath: string, opts: { roomsAsItems?: boolean } = {}): Promise<MeasuredPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ url: filePath, useSystemFonts: true }).promise;
  const pages: MeasuredPage[] = [];
  try {
    const extractedPages = await extractAllPages(doc, pdfjs.OPS);
    const document = contextFromPages(extractedPages);
    for (const { pageNumber: pageNo, extracted, calibration } of extractedPages) {
      const base = { pageNumber: pageNo, segments: extracted.segments.length, texts: extracted.texts.length };
      const raster = rasterNote(extracted);
      if (raster) {
        const { kind, title } = classifySheet(extracted.texts, false, hasRoomWords(extracted));
        pages.push({ ...base, kind, title, calibration: null, items: [], note: raster });
        continue;
      }
      if (extracted.segments.length < 100) {
        pages.push({ ...base, kind: "unknown", title: null, calibration: null, items: [], note: "fewer than 100 segments: the session path would try vision here" });
        continue;
      }
      const doorProbe = countDoorArcs(extracted.curves, calibration?.mmPerPt ?? 17.68);
      const { kind, title } = classifySheet(extracted.texts, doorProbe.count > 0, hasRoomWords(extracted));
      if (!calibration) {
        pages.push({ ...base, kind, title, calibration: null, items: [], note: "no reliable scale" });
        continue;
      }
      if (kind !== "floor-plan") {
        pages.push({ ...base, kind, title, calibration, items: [], note: `classified as ${kind}; not measured` });
        continue;
      }
      const measured = measureSheetRegions(extracted, calibration.mmPerPt, calibration.confidence, pageNo, `page ${pageNo}`, opts.roomsAsItems ?? false, {
        calibrationMatches: calibration.matches,
        dimUnit: calibration.dimUnit,
        document,
      });
      const items =
        calibration.confidence < 0.7
          ? measured.items.map((i) => ({ ...i, confidence: "low" as const, confidenceReason: i.confidenceReason ?? "scale" }))
          : measured.items;
      pages.push({ ...base, kind, title, calibration, items, note: null });
    }
  } finally {
    await doc.cleanup();
  }
  return pages;
}
