import type { Confidence, MeasuredBoqItem } from "../types.ts";
import { barTonnes, nearestBarSize } from "./steel-mass.ts";

export interface BarRow {
  barMark: string | null;
  sizeMm: number;
  number: number;
  lengthMm: number;
  tonnes: number;
}

export interface BbsReading {
  rows: BarRow[];
  tonnesBySize: Record<number, number>;
  totalTonnes: number;
}

const BBS_MARKER = /\b(bar\s*bending|reinforcement\s*schedule|bar\s*mark|b\.?b\.?s\.?)\b/i;
const BAR_SIZE = /\b(?:T|Y|H|R|Ø|dia\.?)?\s*(6|8|10|12|16|20|25|32|40)\b/i;

export function looksLikeBbs(lines: string[]): boolean {
  const joined = lines.join(" \n ");
  if (!BBS_MARKER.test(joined)) return false;
  const numericRows = lines.filter((l) => BAR_SIZE.test(l) && /\d{2,}/.test(l)).length;
  return numericRows >= 3;
}

// Parses a bar bending schedule line into a bar row. A BBS row carries a bar
// mark, size, number of bars and cut length; totals are the QS-standard
// length x number x mass/1000. Hooks/bends/laps are BESMM-deemed (C21), so no
// wastage factor is added. Returns null for lines that are not bar rows.
function parseBarRow(line: string): BarRow | null {
  const sizeMatch = line.match(BAR_SIZE);
  if (!sizeMatch) return null;
  const sizeMm = nearestBarSize(Number(sizeMatch[1]));
  const numbers = [...line.matchAll(/\b(\d{1,5})(?:\.\d+)?\b/g)].map((m) => Number(m[0]));
  if (numbers.length < 2) return null;
  const markMatch = line.match(/\b([A-Z]?\d{1,3}[A-Z]?)\b/);
  const lengthMm = Math.max(...numbers);
  const plausibleCounts = numbers.filter((n) => n !== lengthMm && n >= 1 && n <= 2000);
  const number = plausibleCounts.length > 0 ? Math.max(...plausibleCounts) : 1;
  if (lengthMm < 100) return null;
  const t = barTonnes(sizeMm, number, lengthMm);
  if (t === null) return null;
  return { barMark: markMatch ? markMatch[1]! : null, sizeMm, number, lengthMm, tonnes: t };
}

export function readBbs(lines: string[]): BbsReading | null {
  if (!looksLikeBbs(lines)) return null;
  const rows: BarRow[] = [];
  for (const line of lines) {
    const row = parseBarRow(line);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return null;
  const tonnesBySize: Record<number, number> = {};
  for (const row of rows) tonnesBySize[row.sizeMm] = (tonnesBySize[row.sizeMm] ?? 0) + row.tonnes;
  const totalTonnes = rows.reduce((s, r) => s + r.tonnes, 0);
  return { rows, tonnesBySize, totalTonnes };
}

// Emits BESMM reinforcement items (tonnes, by nominal size) measured from a
// bar bending schedule. Only called when a real BBS is present — with no
// schedule the engine emits NOTHING here rather than fabricating tonnage.
export function bbsToItems(reading: BbsReading, pageNumber: number): MeasuredBoqItem[] {
  const items: MeasuredBoqItem[] = [];
  const sizes = Object.keys(reading.tonnesBySize).map(Number).sort((a, b) => a - b);
  for (const size of sizes) {
    const tonnes = Math.round(reading.tonnesBySize[size]! * 100) / 100;
    if (tonnes <= 0) continue;
    const confidence: Confidence = "high";
    items.push({
      elementGroup: "Frame",
      workSection: { code: "1.11", title: "INSITU CONCRETE WORKS" },
      specNote: "High yield steel bar reinforcement to BS4449",
      groupHeading: "Reinforcement",
      code: "R34",
      description: `High yield steel bars; ${size}mm nominal size; straight and bent`,
      unit: "tonnes",
      qtyGross: tonnes,
      deductions: [],
      qty: tonnes,
      confidence,
      measurementBasis: `Measured from bar bending schedule: ${size}mm bars totalling ${tonnes} t (length x number x ${size}mm mass/1000; hooks/bends deemed per BESMM C21)`,
      geometries: [],
      pageNumber,
    });
  }
  return items;
}
