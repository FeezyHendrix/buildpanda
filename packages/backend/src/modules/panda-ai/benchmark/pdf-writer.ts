import PDFDocument from "pdfkit";
import type { Drawing, Primitive, Sheet } from "./types.ts";

// Renders each sheet at 1:100 on the smallest landscape ISO page it fits (A3
// up to A0, as a CAD export would) with walls in a heavy pen, everything else
// hairline, bare-integer dimension strings centred just above their dimension
// lines, room labels and a sheet title. The PDF engine calibrates from exactly
// those cues.

const PAGES: [number, number][] = [
  [1190.55, 841.89],
  [1683.78, 1190.55],
  [2383.94, 1683.78],
  [3370.39, 2383.94],
];
const MARGIN = 60;
const SCALE = 100;
const PT_PER_MM = 72 / 25.4 / SCALE;
const HEAVY_PT = 0.6;
const THIN_PT = 0.1;

interface Frame {
  page: [number, number];
  toX: (mm: number) => number;
  toY: (mm: number) => number;
}

function frameFor(sheet: Sheet): Frame {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const p of sheet.primitives) {
    if (p.kind === "line") {
      grow(p.x1, p.y1);
      grow(p.x2, p.y2);
    } else if (p.kind === "polyline") for (const [x, y] of p.points) grow(x!, y!);
    else if (p.kind === "arc") grow(p.cx - p.r, p.cy - p.r), grow(p.cx + p.r, p.cy + p.r);
    else if (p.kind === "text" || p.kind === "insert") grow(p.x, p.y);
    else if (p.kind === "dimension") {
      grow(p.x1, p.y1);
      grow(p.x2, p.y2);
      grow(p.x1 + (p.x1 === p.x2 ? p.offset : 0), p.y1 + (p.y1 === p.y2 ? p.offset : 0));
    }
  }
  // extra room for text beside the plan and the title below it
  minY -= 1200;
  maxX += 6000;
  const needW = (maxX - minX) * PT_PER_MM + 2 * MARGIN;
  const needH = (maxY - minY) * PT_PER_MM + 2 * MARGIN;
  const page = PAGES.find(([w, h]) => w >= needW && h >= needH) ?? PAGES[PAGES.length - 1]!;
  return {
    page,
    toX: (mm) => MARGIN + (mm - minX) * PT_PER_MM,
    toY: (mm) => MARGIN + (maxY - mm) * PT_PER_MM,
  };
}

function drawPrimitive(doc: PDFKit.PDFDocument, p: Primitive, fr: Frame, drawing: Drawing, exploded: boolean): void {
  const blockById = new Map(drawing.blocks.map((b) => [b.name, b]));
  switch (p.kind) {
    case "line":
      doc.lineWidth(p.heavy ? HEAVY_PT : THIN_PT).moveTo(fr.toX(p.x1), fr.toY(p.y1)).lineTo(fr.toX(p.x2), fr.toY(p.y2)).stroke();
      return;
    case "polyline": {
      doc.lineWidth(p.heavy ? HEAVY_PT : THIN_PT);
      const [first, ...rest] = p.points;
      doc.moveTo(fr.toX(first![0]!), fr.toY(first![1]!));
      for (const [x, y] of rest) doc.lineTo(fr.toX(x!), fr.toY(y!));
      if (p.closed) doc.closePath();
      doc.stroke();
      return;
    }
    case "arc": {
      // an SVG arc, which pdfkit emits as cubic beziers the engine reads as curves
      const r = p.r * PT_PER_MM;
      const a0 = (p.startDeg * Math.PI) / 180;
      const a1 = (p.endDeg * Math.PI) / 180;
      const sx = fr.toX(p.cx + p.r * Math.cos(a0));
      const sy = fr.toY(p.cy + p.r * Math.sin(a0));
      const ex = fr.toX(p.cx + p.r * Math.cos(a1));
      const ey = fr.toY(p.cy + p.r * Math.sin(a1));
      const large = p.endDeg - p.startDeg > 180 ? 1 : 0;
      doc.lineWidth(THIN_PT).path(`M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`).stroke();
      return;
    }
    case "text": {
      const size = Math.max(4, p.height * PT_PER_MM);
      doc.font("Helvetica").fontSize(size).fillColor("#000000");
      if (exploded && /^[0-9]+$/.test(p.text)) {
        let x = fr.toX(p.x);
        for (const ch of p.text) {
          doc.text(ch, x, fr.toY(p.y) - size, { lineBreak: false });
          x += doc.widthOfString(ch) + 0.3;
        }
      } else {
        doc.text(p.text, fr.toX(p.x), fr.toY(p.y) - size, { lineBreak: false });
      }
      return;
    }
    case "insert": {
      const block = blockById.get(p.block);
      if (!block) return;
      const rad = (p.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      for (const bp of block.primitives) {
        const place = (x: number, y: number): [number, number] => [p.x + x * cos - y * sin, p.y + x * sin + y * cos];
        if (bp.kind === "line") {
          const [x1, y1] = place(bp.x1, bp.y1);
          const [x2, y2] = place(bp.x2, bp.y2);
          drawPrimitive(doc, { ...bp, x1, y1, x2, y2 }, fr, drawing, exploded);
        } else if (bp.kind === "polyline") {
          drawPrimitive(doc, { ...bp, points: bp.points.map(([x, y]) => place(x!, y!)) }, fr, drawing, exploded);
        } else if (bp.kind === "arc") {
          const [cx, cy] = place(bp.cx, bp.cy);
          drawPrimitive(doc, { ...bp, cx, cy, startDeg: bp.startDeg + p.rotationDeg, endDeg: bp.endDeg + p.rotationDeg }, fr, drawing, exploded);
        }
      }
      return;
    }
    case "dimension": {
      const horizontal = p.y1 === p.y2;
      const lx1 = horizontal ? p.x1 : p.x1 + p.offset;
      const ly1 = horizontal ? p.y1 + p.offset : p.y1;
      const lx2 = horizontal ? p.x2 : p.x2 + p.offset;
      const ly2 = horizontal ? p.y2 + p.offset : p.y2;
      doc.lineWidth(THIN_PT).moveTo(fr.toX(lx1), fr.toY(ly1)).lineTo(fr.toX(lx2), fr.toY(ly2)).stroke();
      const label = String(Math.round(p.value));
      const size = 6;
      doc.font("Helvetica").fontSize(size).fillColor("#000000");
      const w = doc.widthOfString(label);
      if (horizontal) {
        const cx = (fr.toX(lx1) + fr.toX(lx2)) / 2;
        // baseline sits about 3 pt above the dimension line
        doc.text(label, cx - w / 2, fr.toY(ly1) - 3 - size * 0.8, { lineBreak: false });
      } else {
        const cy = (fr.toY(ly1) + fr.toY(ly2)) / 2;
        const x = fr.toX(lx1) - 3;
        doc.save().rotate(-90, { origin: [x, cy] }).text(label, x - w / 2, cy - size * 0.8, { lineBreak: false }).restore();
      }
      return;
    }
    default:
      return;
  }
}

export function writePdf(drawing: Drawing): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGES[0], layout: "portrait", margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const exploded = drawing.convention.dimensions === "exploded";
    for (const sheet of drawing.sheets) {
      const fr = frameFor(sheet);
      doc.addPage({ size: fr.page, margin: 0 });
      doc.strokeColor("#000000");
      for (const p of sheet.primitives) drawPrimitive(doc, p, fr, drawing, exploded);
    }
    doc.end();
  });
}
