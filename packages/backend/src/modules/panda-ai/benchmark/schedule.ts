import type { Line, Primitive, Sheet, Text, TruthSheet } from "./types.ts";

// A door and window schedule drawn as a table: the sheet a reader turns to
// for sizes, and a sheet the engine must not measure as a plan.

export interface ScheduleRow {
  mark: string;
  widthMm: number;
  heightMm: number;
  nr: number;
}

const COL_W = [2400, 2400, 2400, 1800];
const ROW_H = 700;

function table(id: string, x: number, y: number, title: string, rows: ScheduleRow[], out: Primitive[]): number {
  const width = COL_W.reduce((a, b) => a + b, 0);
  const lines = ["MARK|WIDTH|HEIGHT|NR", ...rows.map((r) => `${r.mark}|${r.widthMm}|${r.heightMm}|${r.nr}`)];
  const height = (lines.length + 1) * ROW_H;
  const text = (s: string, tx: number, ty: number, str: string, h = 250): Text => ({ kind: "text", id: `${id}_${s}`, layer: "text", x: tx, y: ty, height: h, text: str });
  const line = (s: string, x1: number, y1: number, x2: number, y2: number): Line => ({ kind: "line", id: `${id}_${s}`, layer: "zero", x1, y1, x2, y2 });
  out.push(text("title", x, y + 300, title, 350));
  for (let r = 0; r <= lines.length; r++) out.push(line(`h${r}`, x, y - r * ROW_H, x + width, y - r * ROW_H));
  let cx = x;
  for (let c = 0; c <= COL_W.length; c++) {
    out.push(line(`v${c}`, cx, y, cx, y - lines.length * ROW_H));
    cx += COL_W[c] ?? 0;
  }
  lines.forEach((row, r) => {
    let tx = x + 200;
    row.split("|").forEach((cell, c) => {
      out.push(text(`c${r}_${c}`, tx, y - (r + 1) * ROW_H + 200, cell));
      tx += COL_W[c]!;
    });
  });
  return height;
}

export function scheduleSheet(doors: ScheduleRow[], windows: ScheduleRow[], originX: number): { sheet: Sheet; truth: TruthSheet } {
  const out: Primitive[] = [];
  const title = "DOOR AND WINDOW SCHEDULE";
  const used = table("sched_d", 0, 12_000, "DOOR SCHEDULE", doors, out);
  table("sched_w", 0, 12_000 - used - 1500, "WINDOW SCHEDULE", windows, out);
  out.push({ kind: "text", id: "sched_ttl", layer: "text", x: 0, y: -3200, height: 450, text: title });
  out.push({ kind: "text", id: "sched_note", layer: "text", x: 0, y: -4000, height: 250, text: "ALL SIZES ARE STRUCTURAL OPENINGS IN MM." });
  return {
    sheet: { id: "sched", kind: "schedule", title, level: null, originX, originY: 0, primitives: out },
    truth: { id: "sched", kind: "schedule", title, level: null, repeats: 1 },
  };
}
