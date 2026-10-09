import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { renderPdfPageViews } from "../../../lib/document-render.ts";
import { readDrawingEvidence, classifyDrawingPage, drawingPageContext, drawingScheduleLines } from "./engine/drawing-evidence.ts";
import { readSessionDrawings } from "./engine/read-drawings.ts";
import { contextFromPages } from "./engine/measure-file.ts";
import { buildDocumentContext, levelMarks, windowHeightFromElevations } from "./engine/document-context.ts";
import { looksLikeScheduleSheet } from "./engine/schedule.ts";
import { wallItems } from "./engine/sheet-items.ts";
import { anchorsFromRows, buildAnchors } from "./engine/enrich.ts";
import type { DrawingEvidence, ReadDrawingPage } from "./engine/drawing-evidence-types.ts";
import type { RegionMeasurement } from "./engine/region-measure.ts";
import type { PreconBoqRowRow, PreconSheetRow, TextRun } from "./types.ts";

function texts(...lines: string[]): TextRun[] {
  return lines.map((str, i) => ({ str, x: 10, y: 100 - i * 10, w: 70, rotated: false }));
}

async function pdf(lines: string[], colors?: string[]): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, compress: false });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  lines.forEach((line, i) => {
    doc.addPage({ size: [180, 120], margin: 5 });
    if (colors?.[i]) doc.rect(0, 0, 180, 120).fill(colors[i]!);
    else doc.fontSize(7).text(line, 10, 10);
  });
  doc.end();
  return result;
}

function page(pageNumber: number, native: TextRun[], evidence: DrawingEvidence | null = null): ReadDrawingPage {
  return { pageNumber, globalPage: pageNumber, label: `drawings.pdf p${pageNumber}`, extracted: { texts: native, segments: [], curves: [] }, calibration: null, evidence };
}

test("visual reading preserves every region, table row and specification without requiring a scale", async () => {
  const evidence: DrawingEvidence = {
    regions: [
      { title: "Ground floor plan", kind: "floor-plan", lines: ["Kitchen"] },
      { title: "Section A-A", kind: "section", lines: ["Typical storey height: 3500 mm"] },
      { title: "Detail 4", kind: "detail", lines: ["150mm reinforced concrete slab; C25/30"] },
      { title: "Door schedule", kind: "schedule", lines: ["Type | Width mm | Height mm | Qty", "D1 | 900 | 2400 | 6"] },
    ], warnings: [],
  };
  const result = await readDrawingEvidence("drawings.pdf p8", [Buffer.from("overview"), Buffer.from("detail")], async (prompt, images) => {
    assert.match(prompt, /EVERY region/);
    assert.match(prompt, /without a scale/);
    assert.equal(images.length, 2);
    return JSON.stringify(evidence);
  });
  assert.deepEqual(result, evidence);
  const context = drawingPageContext(page(8, texts("Native title"), result));
  assert.match(context, /DRAWING PAGE 8/);
  assert.match(context, /Detail 4/);
  assert.match(context, /C25\/30/);
  assert.deepEqual(drawingScheduleLines(page(8, [], result)), ["Door schedule", "Type | Width mm | Height mm | Qty", "D1 | 900 | 2400 | 6"]);
});

test("unreadable visual responses fall back to native schedule text on sparse later pages", async () => {
  assert.equal(await readDrawingEvidence("p8", [], async () => "unreadable"), null);
  assert.equal(await readDrawingEvidence("p8", [], async () => '{"regions":[{"kind":"invented"}]}'), null);
  const last = page(8, texts("BAR BENDING SCHEDULE", "Mark | Diameter | Length | Number", "B1 | 16 | 6000 | 10"));
  assert.equal(last.extracted.segments.length, 0);
  assert.equal(drawingScheduleLines(last).length, 3);
  for (const name of ["PILE SCHEDULE", "Schedule of doors", "WINDOW SCHEDULE", "VENTILATION SCHEDULE"]) {
    assert.ok(looksLikeScheduleSheet(texts(name)), name);
  }
});

test("only the requested PDF page is rendered, as an overview and four bounded detail views", async () => {
  const buffer = await pdf(["first", "second"], ["#ff0000", "#0000ff"]);
  const views = await renderPdfPageViews(buffer, 2);
  assert.equal(views.length, 5);
  for (const view of views) {
    const { data, info } = await sharp(view).raw().toBuffer({ resolveWithObject: true });
    assert.ok(info.width <= 2201 && info.height <= 2201);
    const centre = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
    assert.deepEqual([...data.subarray(centre, centre + 3)], [0, 0, 255]);
  }
  await assert.rejects(renderPdfPageViews(buffer, 3), /out of range/);
});

test("all pages and files contribute before plan measurement, including after page six and a failed visual page", async () => {
  const dir = await mkdtemp(join(tmpdir(), "drawing-evidence-"));
  try {
    const main = join(dir, "plans.pdf");
    const details = join(dir, "details.pdf");
    await writeFile(main, await pdf(["Ground floor plan", ...Array.from({ length: 7 }, (_, i) => `Drawing ${i + 2}`)]));
    await writeFile(details, await pdf(["SECTION A-A\n+0.000 GROUND FLOOR\n+3.500 FIRST FLOOR"]));
    const sheets = [main, main, details].map((storage_path, i) => ({
      id: `sheet-${i}`, storage_path, file_name: i === 2 ? "details.pdf" : "plans.pdf",
    }) as PreconSheetRow);
    const seen: string[] = [];
    const progress: string[] = [];
    const files = await readSessionDrawings(sheets, (_phase, message) => { progress.push(message); }, {
      withFile: async (storage, _extension, read) => read(storage),
      readEvidence: async (label, images) => {
        seen.push(label);
        assert.equal(images.length, 5);
        if (label.endsWith("p3")) throw new Error("unreadable");
        return { regions: [{ title: "Detail", kind: "detail", lines: label.endsWith("p8") ? ["150mm reinforced concrete slab"] : [] }], warnings: [] };
      },
    });
    const pages = files.flatMap((file) => file.pages);
    assert.equal(files.length, 2, "expanded sheet rows must not re-read the same PDF");
    assert.equal(pages.length, 9);
    assert.equal(seen.length, 9);
    assert.equal(pages[8]!.globalPage, 9);
    assert.ok(progress.some((message) => message.includes("check this sheet in review")));
    assert.match(pages.map(drawingPageContext).join("\n"), /150mm reinforced concrete slab/);
    const document = contextFromPages(pages);
    assert.equal(document.storeyHeightM, 3.5);
    assert.equal(document.storeyHeightBasis, "level-marks");
    const measured = {
      walls: { pairs: [0, 1].map((y) => ({ lengthM: 5, gapMm: 225, vertices: [[0, y], [100, y]] })) },
      openings: [], dimensionCheck: { ok: true, note: "matches written dimensions" },
    } as unknown as RegionMeasurement;
    const [wall] = wallItems(measured, { document, scaleTrusted: true, scaleNote: "confirmed", envelopeUntrustworthy: false, pageNumber: 1, sheetLabel: "plans.pdf p1" });
    assert.equal(wall!.qtyGross, 35, "the first plan's 10m of walls must use the later section's 3.5m height");
    assert.match(wall!.measurementBasis, /3.5m storey height from level marks/);
    assert.match(wall!.measurementBasis, /drawing page 9: details.pdf p1/);
    assert.equal(buildAnchors([wall!]).wall_centreline_m, 10, "build-up must keep the measured length when supporting drawings change the wall height");
    const reviewed = { code: wall!.code, qty: wall!.qty, status: "verified", measurement_basis: wall!.measurementBasis } as unknown as PreconBoqRowRow;
    assert.equal(anchorsFromRows([reviewed]).wall_centreline_m, 10);
    assert.equal(buildAnchors([{ ...wall!, measurementBasis: "Height and centreline unconfirmed" }]).wall_centreline_m, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a raster detail's stated height informs plan quantities without inventing quantities for the detail", () => {
  const context = contextFromPages([
    page(1, texts("Ground floor plan")),
    page(8, [], { regions: [{ title: "Section A-A", kind: "section", lines: ["Typical storey height: 3200 mm"] }], warnings: [] }),
  ]);
  assert.equal(context.storeyHeightM, 3.2);
  assert.equal(context.storeyHeightBasis, "drawing-note");
  const conflicting = buildDocumentContext([{ texts: texts("Storey height: 3000 mm", "Storey height: 3600 mm"), segments: [], mmPerPt: null }]);
  assert.equal(conflicting.storeyHeightBasis, "assumed");
  assert.deepEqual(levelMarks(texts("+0.000 GROUND FLOOR", "+3.200 FIRST FLOOR")), [0, 3200]);
});

test("an uncalibrated elevation never borrows the floor plan's scale", () => {
  const segments = [0, 100].flatMap((x, path) => [[x, 0, x + 30, 0], [x + 30, 0, x + 30, 40], [x + 30, 40, x, 40], [x, 40, x, 0]]
    .map(([x1, y1, x2, y2]) => ({ x1: x1!, y1: y1!, x2: x2!, y2: y2!, len: Math.hypot(x2! - x1!, y2! - y1!), width: 1, color: "#000000", closed: true, path })));
  const elevation = { texts: texts("Front elevation"), segments, mmPerPt: null };
  assert.equal(windowHeightFromElevations([elevation], 35, 3), null);
  assert.equal(windowHeightFromElevations([{ ...elevation, mmPerPt: 35 }], null, 3), 1.4);
  assert.equal(windowHeightFromElevations([{ ...elevation, texts: texts("Ground floor plan"), mmPerPt: 35 }], null, 3), null);
});

test("floor labels in a section do not turn that supporting view into another floor plan", () => {
  const section = page(3, texts("FIRST FLOOR", "Kitchen"), {
    regions: [{ title: "Section A-A", kind: "section", lines: ["FIRST FLOOR", "Kitchen", "150mm slab"] }], warnings: [],
  });
  assert.equal(classifyDrawingPage(section).kind, "section");
  assert.equal(classifyDrawingPage(page(1, texts("Ground floor plan"))).kind, "floor-plan");
});
