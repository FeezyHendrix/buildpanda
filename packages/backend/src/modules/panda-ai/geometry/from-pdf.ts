import type { ExtractedSheet } from "../pdf-takeoff/types.ts";
import type { GeoArc, GeoDocument, GeoSegment, GeoText, GeoUnreadable } from "./types.ts";

// PDF → GeoDocument. When the page's operator list is supplied the walk
// recovers what the measuring extractor drops: whether a path was filled or
// stroked, the line width scaled by the current transform, and the optional
// content group (the CAD layer that survived the export). Without it, the
// document is built from the already-extracted segments and texts.

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export interface PdfOperatorList {
  fnArray: number[];
  argsArray: unknown[];
}

// pdf.js operator ids the walk needs; every one is optional so a partial map
// (the measuring engine passes only six) still works.
export interface PdfOpIds {
  save?: number;
  restore?: number;
  transform?: number;
  setLineWidth?: number;
  setStrokeRGBColor?: number;
  constructPath?: number;
  beginMarkedContentProps?: number;
  endMarkedContent?: number;
  fill?: number;
  eoFill?: number;
  fillStroke?: number;
  eoFillStroke?: number;
  closeFillStroke?: number;
  closeEOFillStroke?: number;
}

const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const CLOSE_PATH = 3;

const PAGE_UNITS: GeoDocument["units"] = {
  unit: "unknown",
  basis: "assumed",
  confidence: 0,
  note: "PDF page space in points; real-world scale comes from calibration",
};

function fromExtracted(extracted: ExtractedSheet): Pick<GeoDocument, "segments" | "arcs" | "texts" | "unreadable"> {
  const segments: GeoSegment[] = extracted.segments.map((s, i) => ({
    id: `s${i}`,
    x1: s.x1,
    y1: s.y1,
    x2: s.x2,
    y2: s.y2,
    layer: null,
    width: s.width,
    color: null,
    fill: false,
  }));
  const texts: GeoText[] = extracted.texts.map((t, i) => ({ id: `t${i}`, text: t.str, x: t.x, y: t.y, height: null, layer: null, kind: "text" }));
  const unreadable: GeoUnreadable[] = [];
  if (extracted.curves.length > 0) {
    unreadable.push({ what: "curves", count: extracted.curves.length, note: "Bezier curves (door swings, circles) are kept for arc probes but not flattened into the document" });
  }
  return { segments, arcs: [] as GeoArc[], texts, unreadable };
}

export function fromPdf(extracted: ExtractedSheet, ops?: PdfOperatorList, OPS?: PdfOpIds): GeoDocument {
  const base = fromExtracted(extracted);
  let segments = base.segments;
  const layerCount = new Map<string, number>();

  if (ops && OPS && OPS.constructPath !== undefined) {
    const fillOps = new Set(
      [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter((v): v is number => typeof v === "number"),
    );
    segments = [];
    let ctm: Matrix = IDENTITY;
    const stack: Matrix[] = [];
    let lineWidth = 1;
    let layer: string | null = null;
    const layerStack: (string | null)[] = [];
    let index = 0;
    const apply = (x: number, y: number): [number, number] => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
    const scaledWidth = () => lineWidth * Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]!;
      const args = ops.argsArray[i] as unknown[];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
      else if (fn === OPS.transform) ctm = multiply(ctm, args as unknown as Matrix);
      else if (fn === OPS.setLineWidth) lineWidth = args[0] as number;
      else if (fn === OPS.beginMarkedContentProps) {
        layerStack.push(layer);
        const tag = String(args[0] ?? "");
        const props = args[1] as { name?: string; id?: string } | null | undefined;
        if (tag === "OC" && props) layer = props.name ?? props.id ?? layer;
      } else if (fn === OPS.endMarkedContent) layer = layerStack.length ? (layerStack.pop() ?? null) : null;
      else if (fn === OPS.constructPath) {
        const paintOp = args[0] as number;
        const fill = fillOps.has(paintOp);
        const pathData = args[1] as ArrayLike<number>[];
        if (!pathData) continue;
        for (const data of pathData) {
          const d = data instanceof Float32Array ? data : Float32Array.from(Object.values(data));
          let j = 0;
          let x = 0;
          let y = 0;
          let startX = 0;
          let startY = 0;
          while (j < d.length) {
            const op = d[j]!;
            if (op === MOVE_TO) {
              [x, y] = apply(d[j + 1]!, d[j + 2]!);
              startX = x;
              startY = y;
              j += 3;
            } else if (op === LINE_TO) {
              const [nx, ny] = apply(d[j + 1]!, d[j + 2]!);
              segments.push({ id: `s${index++}`, x1: x, y1: y, x2: nx, y2: ny, layer, width: scaledWidth(), color: null, fill });
              if (layer) layerCount.set(layer, (layerCount.get(layer) ?? 0) + 1);
              x = nx;
              y = ny;
              j += 3;
            } else if (op === CURVE_TO) {
              const [ex, ey] = apply(d[j + 5]!, d[j + 6]!);
              x = ex;
              y = ey;
              j += 7;
            } else if (op === CLOSE_PATH) {
              if (x !== startX || y !== startY) {
                segments.push({ id: `s${index++}`, x1: x, y1: y, x2: startX, y2: startY, layer, width: scaledWidth(), color: null, fill });
              }
              j += 1;
            } else j += 1;
          }
        }
      }
    }
  }

  return {
    source: "pdf",
    units: PAGE_UNITS,
    space: "page",
    layers: [...layerCount.entries()].map(([name, count]) => ({ name, count, color: null })).sort((a, b) => b.count - a.count),
    blocks: [],
    segments,
    shapes: [],
    arcs: base.arcs,
    inserts: [],
    texts: base.texts,
    dimensions: [],
    unreadable: base.unreadable,
  };
}
