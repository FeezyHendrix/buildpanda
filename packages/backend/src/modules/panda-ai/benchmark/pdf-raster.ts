import * as zlib from "node:zlib";
import type { Primitive, Sheet } from "./types.ts";

// A sheet as a scanned-looking bitmap: lines burnt into a grey PNG at a
// tenth of a millimetre... no, at 0.1 px per mm (10 px per metre), which is
// what a plan looks like after someone printed it and scanned it back. Text
// is left out: a scan's text is pixels, not strings, and that is the point.

const PX_PER_MM = 0.1;
const PAD_MM = 1000;

interface Bitmap {
  w: number;
  h: number;
  px: Uint8Array;
  minX: number;
  maxY: number;
}

function plot(b: Bitmap, x: number, y: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && px < b.w && py >= 0 && py < b.h) b.px[py * b.w + px] = 0;
    }
  }
}

function line(b: Bitmap, x1: number, y1: number, x2: number, y2: number, r: number): void {
  const X = (mm: number) => Math.round((mm - b.minX) * PX_PER_MM);
  const Y = (mm: number) => Math.round((b.maxY - mm) * PX_PER_MM);
  let x = X(x1);
  let y = Y(y1);
  const ex = X(x2);
  const ey = Y(y2);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(b, x, y, r);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function draw(b: Bitmap, p: Primitive, blocks: Map<string, Primitive[]>, ox = 0, oy = 0): void {
  switch (p.kind) {
    case "line":
      line(b, p.x1 + ox, p.y1 + oy, p.x2 + ox, p.y2 + oy, p.heavy ? 1 : 0);
      return;
    case "polyline":
    case "hatch": {
      const pts = p.points;
      for (let i = 1; i < pts.length; i++) line(b, pts[i - 1]![0]! + ox, pts[i - 1]![1]! + oy, pts[i]![0]! + ox, pts[i]![1]! + oy, p.kind === "polyline" && p.heavy ? 1 : 0);
      if (p.kind === "hatch" || p.closed) line(b, pts[pts.length - 1]![0]! + ox, pts[pts.length - 1]![1]! + oy, pts[0]![0]! + ox, pts[0]![1]! + oy, 0);
      return;
    }
    case "arc": {
      let prev: [number, number] | null = null;
      for (let k = 0; k <= 12; k++) {
        const a = ((p.startDeg + ((p.endDeg - p.startDeg) * k) / 12) * Math.PI) / 180;
        const pt: [number, number] = [p.cx + p.r * Math.cos(a) + ox, p.cy + p.r * Math.sin(a) + oy];
        if (prev) line(b, prev[0], prev[1], pt[0], pt[1], 0);
        prev = pt;
      }
      return;
    }
    case "dimension": {
      const horizontal = p.y1 === p.y2;
      if (horizontal) line(b, p.x1 + ox, p.y1 + p.offset + oy, p.x2 + ox, p.y2 + p.offset + oy, 0);
      else line(b, p.x1 + p.offset + ox, p.y1 + oy, p.x2 + p.offset + ox, p.y2 + oy, 0);
      return;
    }
    case "insert": {
      const members = blocks.get(p.block) ?? [];
      const rad = (p.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const sx = p.scaleX ?? 1;
      const place = (x: number, y: number): [number, number] => [p.x + ox + sx * x * cos - y * sin, p.y + oy + sx * x * sin + y * cos];
      for (const m of members) {
        if (m.kind === "line") {
          const [x1, y1] = place(m.x1, m.y1);
          const [x2, y2] = place(m.x2, m.y2);
          line(b, x1, y1, x2, y2, m.heavy ? 1 : 0);
        } else if (m.kind === "polyline" || m.kind === "hatch") {
          draw(b, { ...m, points: m.points.map(([x, y]) => place(x!, y!)) }, blocks);
        } else if (m.kind === "arc") {
          const [cx, cy] = place(m.cx, m.cy);
          draw(b, { ...m, cx, cy, startDeg: m.startDeg + p.rotationDeg, endDeg: m.endDeg + p.rotationDeg }, blocks);
        }
      }
      return;
    }
    default:
      return;
  }
}

// ---------- PNG encoding (8-bit grey, no dependencies) ----------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(b: { w: number; h: number; px: Uint8Array }): Buffer {
  const raw = Buffer.alloc((b.w + 1) * b.h);
  for (let y = 0; y < b.h; y++) {
    raw[y * (b.w + 1)] = 0;
    raw.set(b.px.subarray(y * b.w, (y + 1) * b.w), y * (b.w + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(b.w, 0);
  ihdr.writeUInt32BE(b.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export interface RasterSheet {
  png: Buffer;
  // the bitmap's window in sheet millimetres, so the PDF can place it at scale
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rasteriseSheet(sheet: Sheet, blocks: Map<string, Primitive[]>, extent: { minX: number; minY: number; maxX: number; maxY: number }): RasterSheet {
  const minX = extent.minX - PAD_MM;
  const maxX = extent.maxX + PAD_MM;
  const minY = extent.minY - PAD_MM;
  const maxY = extent.maxY + PAD_MM;
  const w = Math.ceil((maxX - minX) * PX_PER_MM);
  const h = Math.ceil((maxY - minY) * PX_PER_MM);
  const b: Bitmap = { w, h, px: new Uint8Array(w * h).fill(255), minX, maxY };
  for (const p of sheet.primitives) draw(b, p, blocks);
  return { png: encodePng(b), minX, minY, maxX, maxY };
}
