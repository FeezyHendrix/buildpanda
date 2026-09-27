import type { DwgDoc, DwgEntity } from "./dwg.ts";

// Renders the model space of a parsed DWG as a plain SVG: lines, polylines,
// arcs, circles, text, and block inserts expanded in place. LibreDWG's own
// dwg2SVG skips inserts and crashes under a non-TTY parent, so the take-off
// viewer draws from the same JSON the measuring engine already reads.

const MAX_PRIMITIVES = 400_000;
const MAX_DEPTH = 6;
const MODEL_SPACE = 2;

type Matrix = [number, number, number, number, number, number]; // a b c d e f (SVG order)

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

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const abs = (ref: number[] | undefined): number | null => (ref && ref.length ? (ref[ref.length - 1] ?? null) : null);
const fmt = (v: number) => (Number.isFinite(v) ? Number(v.toFixed(2)).toString() : "0");
const escape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// MTEXT carries inline formatting codes such as \A1; \P (newline) \fArial|b0; {…}
const stripMtext = (v: string) =>
  v
    .replace(/\\[A-Za-z][^;]*;/g, "")
    .replace(/\\P/g, " ")
    .replace(/[{}]/g, "")
    .trim();

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DwgSvg {
  svg: string;
  primitives: number;
  bounds: Bounds | null;
}

export interface RenderOptions {
  // draw only what falls inside this drawing-unit window: one sheet of the
  // register rather than the whole model space
  bounds?: Bounds;
}

export function renderDwgSvg(doc: DwgDoc, opts: RenderOptions = {}): DwgSvg {
  const byOwner = new Map<number, DwgEntity[]>();
  const clip = opts.bounds;
  const padX = clip ? Math.max((clip.maxX - clip.minX) * 0.02, 1) : 0;
  const padY = clip ? Math.max((clip.maxY - clip.minY) * 0.02, 1) : 0;
  const inside = (x: number, y: number): boolean =>
    !clip || (x >= clip.minX - padX && x <= clip.maxX + padX && y >= clip.minY - padY && y <= clip.maxY + padY);
  const modelSpace: DwgEntity[] = [];
  let modelHeader: number | null = null;
  for (const e of doc.entities) {
    if (e.object === "BLOCK_HEADER" && e.name && /^\*model_space$/i.test(e.name)) modelHeader = abs(e.handle);
  }
  for (const e of doc.entities) {
    if (!e.entity) continue;
    const owner = abs(e.ownerhandle);
    if (e.entmode === MODEL_SPACE || (owner !== null && owner === modelHeader)) {
      modelSpace.push(e);
    } else if (e.entmode === 0 && owner !== null) {
      const list = byOwner.get(owner);
      if (list) list.push(e);
      else byOwner.set(owner, [e]);
    }
  }

  const parts: string[] = [];
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  let primitives = 0;
  const grow = (x: number, y: number) => {
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  };

  const emit = (e: DwgEntity, m: Matrix, depth: number) => {
    if (primitives >= MAX_PRIMITIVES) return;
    switch (e.entity) {
      case "LINE": {
        if (!e.start || !e.end) return;
        const [x1, y1] = apply(m, e.start[0]!, e.start[1]!);
        const [x2, y2] = apply(m, e.end[0]!, e.end[1]!);
        if (!inside(x1, y1) && !inside(x2, y2)) return;
        grow(x1, y1);
        grow(x2, y2);
        parts.push(`<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`);
        primitives++;
        return;
      }
      case "LWPOLYLINE":
      case "POLYLINE_2D": {
        if (!e.points || e.points.length < 2) return;
        const pts = e.points.map((p) => apply(m, p[0]!, p[1]!));
        if (!pts.some(([x, y]) => inside(x, y))) return;
        for (const [x, y] of pts) grow(x, y);
        const closed = e.flag !== undefined && (e.flag & 512) !== 0;
        parts.push(`<${closed ? "polygon" : "polyline"} points="${pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ")}"/>`);
        primitives++;
        return;
      }
      case "CIRCLE": {
        if (!e.center || e.radius === undefined) return;
        const [cx, cy] = apply(m, e.center[0]!, e.center[1]!);
        const r = e.radius * Math.hypot(m[0], m[1]);
        if (!inside(cx, cy)) return;
        grow(cx - r, cy - r);
        grow(cx + r, cy + r);
        parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}"/>`);
        primitives++;
        return;
      }
      case "ARC": {
        if (!e.center || e.radius === undefined || e.start_angle === undefined || e.end_angle === undefined) return;
        const r = e.radius;
        const sx = e.center[0]! + r * Math.cos(e.start_angle);
        const sy = e.center[1]! + r * Math.sin(e.start_angle);
        const ex = e.center[0]! + r * Math.cos(e.end_angle);
        const ey = e.center[1]! + r * Math.sin(e.end_angle);
        let sweep = e.end_angle - e.start_angle;
        if (sweep < 0) sweep += Math.PI * 2;
        const [x1, y1] = apply(m, sx, sy);
        const [x2, y2] = apply(m, ex, ey);
        const rs = r * Math.hypot(m[0], m[1]);
        if (!inside(x1, y1) && !inside(x2, y2)) return;
        grow(x1, y1);
        grow(x2, y2);
        // DWG arcs run counter-clockwise; the matrix may mirror, so pick the
        // sweep flag from the determinant
        const ccw = m[0] * m[3] - m[1] * m[2] >= 0 ? 1 : 0;
        parts.push(`<path d="M${fmt(x1)},${fmt(y1)} A${fmt(rs)},${fmt(rs)} 0 ${sweep > Math.PI ? 1 : 0} ${ccw} ${fmt(x2)},${fmt(y2)}"/>`);
        primitives++;
        return;
      }
      case "TEXT":
      case "MTEXT": {
        const raw = e.entity === "TEXT" ? e.text_value : e.text;
        if (!raw || !e.ins_pt) return;
        const value = e.entity === "MTEXT" ? stripMtext(raw) : raw;
        if (!value) return;
        const [x, y] = apply(m, e.ins_pt[0]!, e.ins_pt[1]!);
        const size = (e.height ?? 2.5) * Math.hypot(m[0], m[1]);
        if (!inside(x, y)) return;
        grow(x, y);
        // text is flipped back upright inside the y-inverted root group
        parts.push(
          `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" transform="translate(${fmt(x)} ${fmt(y)}) scale(1,-1) translate(${fmt(-x)} ${fmt(-y)})">${escape(value.slice(0, 200))}</text>`,
        );
        primitives++;
        return;
      }
      case "INSERT": {
        if (depth >= MAX_DEPTH || !e.ins_pt) return;
        const block = byOwner.get(abs(e.block_header) ?? -1);
        if (!block) return;
        // an insert far outside the window cannot draw inside it (blocks are
        // small relative to a drawing); one padded test avoids expanding it
        if (clip) {
          const [ix, iy] = apply(m, e.ins_pt[0]!, e.ins_pt[1]!);
          const slack = Math.max(padX, padY) * 10;
          if (ix < clip.minX - slack || ix > clip.maxX + slack || iy < clip.minY - slack || iy > clip.maxY + slack) return;
        }
        const sx = e.scale?.[0] ?? 1;
        const sy = e.scale?.[1] ?? 1;
        const rot = e.rotation ?? 0;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const local: Matrix = [cos * sx, sin * sx, -sin * sy, cos * sy, e.ins_pt[0]!, e.ins_pt[1]!];
        const next = multiply(m, local);
        for (const child of block) emit(child, next, depth + 1);
        return;
      }
      default:
        return;
    }
  };

  for (const e of modelSpace) emit(e, IDENTITY, 0);

  if (!Number.isFinite(bounds.minX) || primitives === 0) {
    return { svg: "", primitives: 0, bounds: null };
  }
  // a clipped render frames the sheet's own window, not whatever leaked in
  if (clip) {
    bounds.minX = clip.minX;
    bounds.minY = clip.minY;
    bounds.maxX = clip.maxX;
    bounds.maxY = clip.maxY;
  }
  const w = Math.max(bounds.maxX - bounds.minX, 1);
  const h = Math.max(bounds.maxY - bounds.minY, 1);
  const pad = Math.max(w, h) * 0.02;
  const stroke = Math.max(w, h) / 2500;
  // y is flipped once on the root group so SVG's y-down matches CAD's y-up
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(bounds.minX - pad)} ${fmt(-(bounds.maxY + pad))} ${fmt(w + 2 * pad)} ${fmt(h + 2 * pad)}">` +
    `<rect x="${fmt(bounds.minX - pad)}" y="${fmt(-(bounds.maxY + pad))}" width="${fmt(w + 2 * pad)}" height="${fmt(h + 2 * pad)}" fill="#ffffff"/>` +
    `<g transform="scale(1,-1)" fill="none" stroke="#1f2937" stroke-width="${fmt(stroke)}" stroke-linecap="round" stroke-linejoin="round" font-family="Helvetica, Arial, sans-serif">` +
    parts.join("") +
    `</g></svg>`;
  return { svg, primitives, bounds };
}
