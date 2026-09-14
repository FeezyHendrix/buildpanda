import { extentOf } from "./extent.ts";
import type { BlockDef, Line, Primitive, Sheet, Text } from "./types.ts";

// What a real sheet carries besides the building: a border, a title block, a
// scale bar, a north arrow and a notes column. All of it sits on layer 0 the
// way most offices leave it, and the notes are full of numbers that look
// like dimensions to anything that reads numbers without reading words.

const TITLE_W = 18_000;
const TITLE_H = 5_000;

export const TITLE_BLOCK: BlockDef = {
  name: "TITLEBLOCK-A1",
  primitives: [
    { kind: "polyline", id: "tb_frame", layer: "zero", closed: true, points: [[0, 0], [TITLE_W, 0], [TITLE_W, TITLE_H], [0, TITLE_H]] },
    { kind: "line", id: "tb_l1", layer: "zero", x1: 0, y1: 2500, x2: TITLE_W, y2: 2500 },
    { kind: "line", id: "tb_l2", layer: "zero", x1: 6000, y1: 0, x2: 6000, y2: TITLE_H },
    { kind: "line", id: "tb_l3", layer: "zero", x1: 12_000, y1: 0, x2: 12_000, y2: 2500 },
    { kind: "text", id: "tb_t1", layer: "zero", x: 300, y: 3800, height: 350, text: "PANDA ARCHITECTS" },
    { kind: "text", id: "tb_t2", layer: "zero", x: 300, y: 2900, height: 250, text: "12 MARINA ROAD LAGOS" },
    { kind: "text", id: "tb_t3", layer: "zero", x: 6300, y: 3800, height: 250, text: "PROJECT: PROPOSED RESIDENTIAL DEVELOPMENT" },
    { kind: "text", id: "tb_t4", layer: "zero", x: 6300, y: 2900, height: 250, text: "CLIENT: OGUDU ESTATE LTD" },
    { kind: "text", id: "tb_t5", layer: "zero", x: 300, y: 1500, height: 250, text: "SCALE 1:100" },
    { kind: "text", id: "tb_t6", layer: "zero", x: 300, y: 600, height: 250, text: "DATE 12-08-2026" },
    { kind: "text", id: "tb_t7", layer: "zero", x: 6300, y: 1500, height: 250, text: "DRAWN BY AO" },
    { kind: "text", id: "tb_t8", layer: "zero", x: 6300, y: 600, height: 250, text: "CHECKED BY TE" },
    { kind: "text", id: "tb_t9", layer: "zero", x: 12_300, y: 1500, height: 250, text: "REV P01" },
    { kind: "text", id: "tb_t10", layer: "zero", x: 12_300, y: 600, height: 250, text: "SHEET SIZE A1 594 X 841" },
  ],
};

const NOTES = [
  "GENERAL NOTES",
  "1. ALL DIMENSIONS ARE IN MILLIMETRES.",
  "2. SLAB THICKNESS 150 UNLESS NOTED.",
  "3. COLUMNS 230 X 230 TO ENGINEER'S DETAILS.",
  "4. WINDOW SILL LEVEL 900 ABOVE FFL.",
  "5. DOOR HEIGHT 2100 UNLESS NOTED.",
  "6. CONCRETE GRADE 25 COVER 40.",
  "7. LINTEL 225 X 150 OVER ALL OPENINGS.",
  "8. DO NOT SCALE OFF THIS DRAWING.",
];

export function annotateSheet(sheet: Sheet, index: number): void {
  const ext = extentOf(sheet.primitives);
  const b = { minX: ext.minX - 3000, minY: ext.minY - 8000, maxX: ext.maxX + 22_000, maxY: ext.maxY + 4000 };
  const out: Primitive[] = [];
  const id = (s: string) => `${sheet.id}_an_${s}`;
  const line = (s: string, x1: number, y1: number, x2: number, y2: number): Line => ({ kind: "line", id: id(s), layer: "zero", x1, y1, x2, y2 });
  const text = (s: string, x: number, y: number, height: number, str: string): Text => ({ kind: "text", id: id(s), layer: "zero", x, y, height, text: str });
  // border
  out.push(line("b1", b.minX, b.minY, b.maxX, b.minY), line("b2", b.maxX, b.minY, b.maxX, b.maxY), line("b3", b.maxX, b.maxY, b.minX, b.maxY), line("b4", b.minX, b.maxY, b.minX, b.minY));
  // title block, bottom right, with the sheet's own title and number over it
  const tx = b.maxX - TITLE_W;
  out.push({ kind: "insert", id: id("tb"), layer: "zero", block: TITLE_BLOCK.name, x: tx, y: b.minY, rotationDeg: 0 });
  out.push(text("tt", tx + 12_300, b.minY + 3800, 300, `DRAWING: ${sheet.title}`), text("tn", tx + 12_300, b.minY + 2900, 300, `DRG NO A-${101 + index}`));
  // scale bar, bottom left: a 10 m bar ticked every metre with bare numbers over it
  const sx = b.minX + 2000;
  const sy = b.minY + 2000;
  out.push(line("sb", sx, sy, sx + 10_000, sy), line("sb2", sx, sy + 300, sx + 10_000, sy + 300));
  for (let m = 0; m <= 10; m++) out.push(line(`st${m}`, sx + m * 1000, sy, sx + m * 1000, sy + 300));
  for (const m of [0, 1, 2, 5, 10]) out.push(text(`sl${m}`, sx + m * 1000 - 100, sy + 500, 250, String(m)));
  out.push(text("sm", sx + 10_600, sy + 500, 250, "m"), text("sc", sx, sy + 1000, 250, "SCALE BAR 1:100"));
  // north arrow, top right
  const nx = b.maxX - 3000;
  const ny = b.maxY - 3500;
  out.push({ kind: "polyline", id: id("na"), layer: "zero", closed: true, points: [[nx, ny], [nx + 600, ny + 1800], [nx, ny + 1400], [nx - 600, ny + 1800]] });
  out.push(text("nn", nx - 150, ny + 2100, 400, "N"));
  // notes column, right of the plan
  const notesX = b.maxX - 21_000;
  NOTES.forEach((n, i) => out.push(text(`n${i}`, notesX, b.maxY - 2500 - i * 600, 250, n)));
  sheet.primitives.push(...out);
}
