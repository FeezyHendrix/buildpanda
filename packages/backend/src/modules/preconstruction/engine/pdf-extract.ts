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

interface PdfOps {
  save: number;
  restore: number;
  transform: number;
  setLineWidth: number;
  setStrokeRGBColor: number;
  constructPath: number;
}

// pdfjs 6.x packs path data as Float32Array runs: [op, ...coords] where
// op 0 = moveTo (2 coords), 1 = lineTo (2), 2 = curveTo (6), 3 = closePath (0).
const MOVE_TO = 0;
const LINE_TO = 1;
const CURVE_TO = 2;
const CLOSE_PATH = 3;

export function extractGeometry(ops: OperatorList, OPS: PdfOps): { segments: Segment[]; curves: Curve[] } {
  const segments: Segment[] = [];
  const curves: Curve[] = [];
  let ctm: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  let lineWidth = 1;
  let color = "#000000";

  const apply = (x: number, y: number): [number, number] => [
    ctm[0] * x + ctm[2] * y + ctm[4],
    ctm[1] * x + ctm[3] * y + ctm[5],
  ];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]!;
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? IDENTITY;
    } else if (fn === OPS.transform) {
      ctm = multiply(ctm, args as unknown as Matrix);
    } else if (fn === OPS.setLineWidth) {
      lineWidth = args[0] as number;
    } else if (fn === OPS.setStrokeRGBColor) {
      color = String(args[0] ?? args);
    } else if (fn === OPS.constructPath) {
      const pathData = args[1] as ArrayLike<number>[];
      if (!pathData) continue;
      for (const data of pathData) {
        const d = data instanceof Float32Array ? data : Float32Array.from(Object.values(data));
        let j = 0;
        let x = 0;
        let y = 0;
        while (j < d.length) {
          const op = d[j]!;
          if (op === MOVE_TO) {
            [x, y] = apply(d[j + 1]!, d[j + 2]!);
            j += 3;
          } else if (op === LINE_TO) {
            const [nx, ny] = apply(d[j + 1]!, d[j + 2]!);
            segments.push({ x1: x, y1: y, x2: nx, y2: ny, len: Math.hypot(nx - x, ny - y), width: lineWidth, color });
            x = nx;
            y = ny;
            j += 3;
          } else if (op === CURVE_TO) {
            const [c1x, c1y] = apply(d[j + 1]!, d[j + 2]!);
            const [c2x, c2y] = apply(d[j + 3]!, d[j + 4]!);
            const [ex, ey] = apply(d[j + 5]!, d[j + 6]!);
            curves.push({ sx: x, sy: y, c1x, c1y, c2x, c2y, ex, ey, width: lineWidth, color });
            x = ex;
            y = ey;
            j += 7;
          } else if (op === CLOSE_PATH) {
            j += 1;
          } else {
            j += 1;
          }
        }
      }
    }
  }
  return { segments, curves };
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
}

export async function extractSheet(page: PdfPageLike, OPS: PdfOps): Promise<ExtractedSheet> {
  const [ops, textContent] = await Promise.all([page.getOperatorList(), page.getTextContent()]);
  const { segments, curves } = extractGeometry(ops, OPS);
  const texts = extractTexts(textContent.items as TextItem[]);
  return { segments, curves, texts };
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
