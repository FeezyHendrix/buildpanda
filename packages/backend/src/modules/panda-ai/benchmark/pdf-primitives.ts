import type { BlockDef, Primitive } from "./types.ts";

// Draws one primitive on a pdfkit page. Walls take the heavy pen and
// everything else the hairline, unless the export is single-pen; dimension
// strings are centred just above their lines; block inserts are expanded
// with rotation and mirroring; solid hatches are filled.

export interface Frame {
  page: [number, number];
  toX: (mm: number) => number;
  toY: (mm: number) => number;
  ptPerMm: number;
}

export interface Pens {
  heavy: number;
  thin: number;
  // dimension label text, given the value in mm
  label: (mm: number, text?: string) => string;
  // digits drawn one glyph at a time (an exploded dimension export)
  exploded: boolean;
}

export function drawPrimitive(doc: PDFKit.PDFDocument, p: Primitive, fr: Frame, blocks: Map<string, BlockDef>, pens: Pens): void {
  switch (p.kind) {
    case "line":
      doc.lineWidth(p.heavy ? pens.heavy : pens.thin).moveTo(fr.toX(p.x1), fr.toY(p.y1)).lineTo(fr.toX(p.x2), fr.toY(p.y2)).stroke();
      return;
    case "polyline":
    case "hatch": {
      doc.lineWidth(p.kind === "polyline" && p.heavy ? pens.heavy : pens.thin);
      const [first, ...rest] = p.points;
      doc.moveTo(fr.toX(first![0]!), fr.toY(first![1]!));
      for (const [x, y] of rest) doc.lineTo(fr.toX(x!), fr.toY(y!));
      if (p.kind === "hatch") doc.closePath().fillColor("#000000").fill();
      else {
        if (p.closed) doc.closePath();
        doc.stroke();
      }
      return;
    }
    case "arc": {
      // an SVG arc, which pdfkit emits as cubic beziers the engine reads as curves
      const r = p.r * fr.ptPerMm;
      const a0 = (p.startDeg * Math.PI) / 180;
      const a1 = (p.endDeg * Math.PI) / 180;
      const sx = fr.toX(p.cx + p.r * Math.cos(a0));
      const sy = fr.toY(p.cy + p.r * Math.sin(a0));
      const ex = fr.toX(p.cx + p.r * Math.cos(a1));
      const ey = fr.toY(p.cy + p.r * Math.sin(a1));
      const large = Math.abs(p.endDeg - p.startDeg) > 180 ? 1 : 0;
      const sweep = p.endDeg > p.startDeg ? 0 : 1;
      doc.lineWidth(pens.thin).path(`M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`).stroke();
      return;
    }
    case "text": {
      const size = Math.max(4, p.height * fr.ptPerMm);
      doc.font("Helvetica").fontSize(size).fillColor("#000000");
      if (pens.exploded && /^[0-9]+$/.test(p.text)) {
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
      const block = blocks.get(p.block);
      if (!block) return;
      const rad = (p.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const sx = p.scaleX ?? 1;
      const place = (x: number, y: number): [number, number] => [p.x + sx * x * cos - y * sin, p.y + sx * x * sin + y * cos];
      for (const bp of block.primitives) {
        if (bp.kind === "line") {
          const [x1, y1] = place(bp.x1, bp.y1);
          const [x2, y2] = place(bp.x2, bp.y2);
          drawPrimitive(doc, { ...bp, x1, y1, x2, y2 }, fr, blocks, pens);
        } else if (bp.kind === "polyline" || bp.kind === "hatch") {
          drawPrimitive(doc, { ...bp, points: bp.points.map(([x, y]) => place(x!, y!)) }, fr, blocks, pens);
        } else if (bp.kind === "arc") {
          const [cx, cy] = place(bp.cx, bp.cy);
          // a mirrored arc sweeps the other way: angles reflect about the y axis
          const start = sx < 0 ? 180 - bp.endDeg : bp.startDeg;
          const end = sx < 0 ? 180 - bp.startDeg : bp.endDeg;
          drawPrimitive(doc, { ...bp, cx, cy, startDeg: start + p.rotationDeg, endDeg: end + p.rotationDeg }, fr, blocks, pens);
        } else if (bp.kind === "text") {
          const [x, y] = place(bp.x, bp.y);
          drawPrimitive(doc, { ...bp, x, y }, fr, blocks, pens);
        } else if (bp.kind === "insert") {
          const [x, y] = place(bp.x, bp.y);
          drawPrimitive(doc, { ...bp, x, y, rotationDeg: bp.rotationDeg + p.rotationDeg }, fr, blocks, pens);
        }
      }
      // attributes print beside the insertion point, as ATTRIB text does
      Object.values(p.attributes ?? {}).forEach((value, i) => drawPrimitive(doc, { kind: "text", id: `${p.id}_att${i}`, layer: "text", x: p.x + 150, y: p.y + 150 + i * 300, height: 200, text: value }, fr, blocks, pens));
      return;
    }
    case "dimension": {
      const horizontal = p.y1 === p.y2;
      const lx1 = horizontal ? p.x1 : p.x1 + p.offset;
      const ly1 = horizontal ? p.y1 + p.offset : p.y1;
      const lx2 = horizontal ? p.x2 : p.x2 + p.offset;
      const ly2 = horizontal ? p.y2 + p.offset : p.y2;
      doc.lineWidth(pens.thin).moveTo(fr.toX(lx1), fr.toY(ly1)).lineTo(fr.toX(lx2), fr.toY(ly2)).stroke();
      const label = pens.label(p.value, p.text);
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
