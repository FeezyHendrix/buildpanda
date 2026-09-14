import type { Curve, ExtractedSheet, Segment, TextRun } from "../types.ts";

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

interface OperatorList {
  fnArray: number[];
  argsArray: unknown[];
}

// pdf.js operator ids. Only the first six are required; the rest let the walk
// recover fills and optional-content layers when the caller passes the full map.
export interface PdfOps {
  save: number;
  restore: number;
  transform: number;
  setLineWidth: number;
  setStrokeRGBColor: number;
  constructPath: number;
  beginMarkedContentProps?: number;
  endMarkedContent?: number;
  fill?: number;
  eoFill?: number;
  fillStroke?: number;
  eoFillStroke?: number;
  closeFillStroke?: number;
  closeEOFillStroke?: number;
  // image painting, so a scanned plan placed on a sheet is recognised as pixels
  paintImageXObject?: number;
  paintJpegXObject?: number;
  paintImageMaskXObject?: number;
  paintInlineImageXObject?: number;
}

export interface ImageSummary {
  count: number;
  // page area the images cover, in square points (the unit square under the CTM at paint time)
  areaPt2: number;
}

// pdfjs 6.x packs path data as Float32Array runs: [op, ...coords] where
// op 0 = moveTo (2 coords), 1 = lineTo (2), 2 = curveTo (6),
// 3 = quadraticCurveTo (4), 4 = closePath (0) — see DrawOPS in pdf.mjs.
const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const QUAD_TO = 3;
const CLOSE_PATH = 4;

interface GraphicsState {
  ctm: Matrix;
  lineWidth: number;
  color: string;
}

// Walks the operator list once. Line widths are scaled by the current
// transform (a CAD export often draws at 1:1 inside a scaled form, so the raw
// `w` operand says nothing about the printed pen), q/Q restore width and colour
// as well as the matrix, every subpath gets an id so closed outlines can be
// rebuilt, and the optional-content group (the surviving CAD layer) and the
// paint operator (fill vs stroke) travel on each segment.
export function extractGeometry(ops: OperatorList, OPS: PdfOps): { segments: Segment[]; curves: Curve[]; images: ImageSummary } {
  const segments: Segment[] = [];
  const curves: Curve[] = [];
  const images: ImageSummary = { count: 0, areaPt2: 0 };
  const imageOps = new Set([OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintImageMaskXObject, OPS.paintInlineImageXObject].filter((v): v is number => typeof v === "number"));
  let state: GraphicsState = { ctm: IDENTITY, lineWidth: 1, color: "#000000" };
  const stack: GraphicsState[] = [];
  let layer: string | null = null;
  const layerStack: (string | null)[] = [];
  const fillOps = new Set(
    [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter(
      (v): v is number => typeof v === "number",
    ),
  );
  let pathId = 0;

  const apply = (x: number, y: number): [number, number] => {
    const m = state.ctm;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  };
  const scaledWidth = () => {
    const m = state.ctm;
    return state.lineWidth * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  };

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]!;
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) {
      stack.push({ ...state });
    } else if (fn === OPS.restore) {
      state = stack.pop() ?? { ctm: IDENTITY, lineWidth: 1, color: "#000000" };
    } else if (fn === OPS.transform) {
      state.ctm = multiply(state.ctm, args as unknown as Matrix);
    } else if (fn === OPS.setLineWidth) {
      state.lineWidth = args[0] as number;
    } else if (fn === OPS.setStrokeRGBColor) {
      state.color = String(args[0] ?? args);
    } else if (imageOps.has(fn)) {
      const m = state.ctm;
      images.count++;
      images.areaPt2 += Math.abs(m[0] * m[3] - m[1] * m[2]);
    } else if (OPS.beginMarkedContentProps !== undefined && fn === OPS.beginMarkedContentProps) {
      layerStack.push(layer);
      const tag = String(args[0] ?? "");
      const props = args[1] as { name?: string; id?: string } | null | undefined;
      if (tag === "OC" && props) layer = props.name ?? props.id ?? layer;
    } else if (OPS.endMarkedContent !== undefined && fn === OPS.endMarkedContent) {
      layer = layerStack.length ? (layerStack.pop() ?? null) : null;
    } else if (fn === OPS.constructPath) {
      const fill = fillOps.has(args[0] as number);
      const pathData = args[1] as ArrayLike<number>[];
      if (!pathData) continue;
      const width = scaledWidth();
      const color = state.color;
      for (const data of pathData) {
        const d = data instanceof Float32Array ? data : Float32Array.from(Object.values(data));
        let j = 0;
        let x = 0;
        let y = 0;
        let startX = 0;
        let startY = 0;
        let first = -1; // index into segments of this subpath's first segment
        const closeSubpath = () => {
          if (first < 0) return;
          if (Math.abs(x - startX) > 1e-6 || Math.abs(y - startY) > 1e-6) {
            segments.push({ x1: x, y1: y, x2: startX, y2: startY, len: Math.hypot(startX - x, startY - y), width, color, fill, layer, path: pathId, closed: true });
          }
          for (let k = first; k < segments.length; k++) segments[k]!.closed = true;
        };
        while (j < d.length) {
          const op = d[j]!;
          if (op === MOVE_TO) {
            [x, y] = apply(d[j + 1]!, d[j + 2]!);
            startX = x;
            startY = y;
            pathId++;
            first = -1;
            j += 3;
          } else if (op === LINE_TO) {
            const [nx, ny] = apply(d[j + 1]!, d[j + 2]!);
            if (first < 0) first = segments.length;
            segments.push({ x1: x, y1: y, x2: nx, y2: ny, len: Math.hypot(nx - x, ny - y), width, color, fill, layer, path: pathId, closed: false });
            x = nx;
            y = ny;
            j += 3;
          } else if (op === CURVE_TO) {
            const [c1x, c1y] = apply(d[j + 1]!, d[j + 2]!);
            const [c2x, c2y] = apply(d[j + 3]!, d[j + 4]!);
            const [ex, ey] = apply(d[j + 5]!, d[j + 6]!);
            curves.push({ sx: x, sy: y, c1x, c1y, c2x, c2y, ex, ey, width, color });
            x = ex;
            y = ey;
            j += 7;
          } else if (op === QUAD_TO) {
            // a quadratic is the cubic with both controls two thirds of the way to its single control
            const [qx, qy] = apply(d[j + 1]!, d[j + 2]!);
            const [ex, ey] = apply(d[j + 3]!, d[j + 4]!);
            curves.push({ sx: x, sy: y, c1x: x + (2 / 3) * (qx - x), c1y: y + (2 / 3) * (qy - y), c2x: ex + (2 / 3) * (qx - ex), c2y: ey + (2 / 3) * (qy - ey), ex, ey, width, color });
            x = ex;
            y = ey;
            j += 5;
          } else if (op === CLOSE_PATH) {
            closeSubpath();
            x = startX;
            y = startY;
            first = -1;
            j += 1;
          } else {
            j += 1;
          }
        }
        // a filled outline is closed by the painter even without an explicit h
        if (fill) closeSubpath();
      }
    }
  }
  return { segments, curves, images };
}

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
}

export function extractTexts(items: TextItem[]): TextRun[] {
  return items
    .filter((t) => t.str.trim().length > 0)
    .map((t) => ({
      str: t.str.trim(),
      x: t.transform[4]!,
      y: t.transform[5]!,
      w: t.width ?? 0,
      rotated: Math.abs(t.transform[1]!) > 0.1,
    }));
}

export interface PdfPageLike {
  getOperatorList(): Promise<OperatorList>;
  getTextContent(): Promise<{ items: unknown[] }>;
  // the page's media box [x0, y0, x1, y1], when the caller is a real pdf.js page
  view?: number[];
}

export async function extractSheet(page: PdfPageLike, OPS: PdfOps): Promise<ExtractedSheet> {
  const [ops, textContent] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
  const { segments, curves, images } = extractGeometry(ops, OPS);
  const texts = extractTexts(textContent.items as TextItem[]);
  const view = page.view;
  const pageAreaPt2 = view && view.length === 4 ? Math.abs((view[2]! - view[0]!) * (view[3]! - view[1]!)) : null;
  return { segments, curves, texts, ops, images: { ...images, pageShare: pageAreaPt2 ? Math.min(1, images.areaPt2 / pageAreaPt2) : null } };
}

// Snap index for the viewer: unique segment endpoints, rounded to 0.1pt,
// capped so the payload stays lightweight.
export function buildSnapIndex(segments: Segment[], cap = 20000): number[][] {
  const seen = new Set<string>();
  const points: number[][] = [];
  for (const s of segments) {
    for (const [x, y] of [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ] as const) {
      const key = `${Math.round(x * 10)}:${Math.round(y * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
      if (points.length >= cap) return points;
    }
  }
  return points;
}
