import PDFDocument from "pdfkit";
import { extentOf } from "./extent.ts";
import { drawPrimitive, type Frame, type Pens } from "./pdf-primitives.ts";
import { rasteriseSheet } from "./pdf-raster.ts";
import type { Drawing, Sheet } from "./types.ts";

// Renders each sheet at 1:100 (1:96 for an imperial drawing, the 1/8" scale)
// on the smallest landscape ISO page it fits (A3 up to A0, as a CAD export
// would) with walls in a heavy pen and everything else hairline, bare-integer
// dimension strings centred just above their dimension lines, room labels and
// a sheet title. The PDF engine calibrates from exactly those cues. A
// single-pen export draws everything at one width; a raster export embeds
// the plan as a bitmap and keeps only the annotations as vectors.

const PAGES: [number, number][] = [
  [1190.55, 841.89],
  [1683.78, 1190.55],
  [2383.94, 1683.78],
  [3370.39, 2383.94],
];
const MARGIN = 60;
const HEAVY_PT = 0.6;
const THIN_PT = 0.1;
const SINGLE_PT = 0.25;

function frameFor(sheet: Sheet, scale: number): Frame & { minX: number; minY: number; maxX: number; maxY: number } {
  const ext = extentOf(sheet.primitives);
  // extra room for text beside the plan and the title below it
  const minX = ext.minX;
  const minY = ext.minY - 1200;
  const maxX = ext.maxX + 6000;
  const maxY = ext.maxY;
  const ptPerMm = 72 / 25.4 / scale;
  const needW = (maxX - minX) * ptPerMm + 2 * MARGIN;
  const needH = (maxY - minY) * ptPerMm + 2 * MARGIN;
  const page = PAGES.find(([w, h]) => w >= needW && h >= needH) ?? PAGES[PAGES.length - 1]!;
  return { page, ptPerMm, minX, minY, maxX, maxY, toX: (mm) => MARGIN + (mm - minX) * ptPerMm, toY: (mm) => MARGIN + (maxY - mm) * ptPerMm };
}

function pensFor(drawing: Drawing): Pens {
  const single = drawing.convention.pdf === "single-pen";
  return {
    heavy: single ? SINGLE_PT : HEAVY_PT,
    thin: single ? SINGLE_PT : THIN_PT,
    label: (mm, text) => text ?? String(Math.round(mm)),
    exploded: drawing.convention.dimensions === "exploded",
  };
}

// A raster page: the building is pixels; the border, title block, scale bar,
// north arrow and notes stay vectors, as they do when a scan is placed on a
// CAD sheet and re-exported.
const isAnnotation = (p: Sheet["primitives"][number]) => p.layer === "zero" || (p.kind === "text" && !/^[+-]?\d/.test(p.text) && p.text.length > 12);

export function writePdf(drawing: Drawing): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGES[0], layout: "portrait", margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const pens = pensFor(drawing);
    const scale = drawing.convention.units === "in" ? 96 : 100;
    const blocks = new Map(drawing.blocks.map((b) => [b.name, b]));
    for (const sheet of drawing.sheets) {
      const fr = frameFor(sheet, scale);
      doc.addPage({ size: fr.page, margin: 0 });
      doc.strokeColor("#000000");
      if (drawing.convention.pdf === "raster" && sheet.kind === "floor-plan") {
        const vectors = sheet.primitives.filter(isAnnotation);
        const bitmap = rasteriseSheet({ ...sheet, primitives: sheet.primitives.filter((p) => !isAnnotation(p)) }, new Map(drawing.blocks.map((b) => [b.name, b.primitives])), extentOf(sheet.primitives));
        doc.image(bitmap.png, fr.toX(bitmap.minX), fr.toY(bitmap.maxY), { width: (bitmap.maxX - bitmap.minX) * fr.ptPerMm, height: (bitmap.maxY - bitmap.minY) * fr.ptPerMm });
        for (const p of vectors) drawPrimitive(doc, p, fr, blocks, pens);
        continue;
      }
      for (const p of sheet.primitives) drawPrimitive(doc, p, fr, blocks, pens);
    }
    doc.end();
  });
}
