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
  // True when the sheet reads as a BBS but too few rows parsed cleanly, so the
  // tonnage is NOT trustworthy — callers must bill rebar as provisional rather
  // than treat the (partial) total as the building's reinforcement.
  unreadable: boolean;
  candidateRows: number;
}

const BBS_MARKER = /\b(bar\s*bending|reinforcement\s*schedule|bar\s*mark|b\.?b\.?s\.?)\b/i;
const BAR_SIZE = /(?:^|[\sTYHR])(?:T|Y|H|R|Ø|dia\.?)?\s*(6|8|10|12|16|20|25|32|40)\b/i;
// A bar cut length in mm is realistically 100..18000; anything <=30 that reached
// the length slot was given in metres, so it is scaled up.
const MIN_LENGTH_MM = 100;
const MAX_LENGTH_MM = 18000;
const MAX_BAR_COUNT = 5000;

// Extracts numbers from a schedule line after normalising thousands separators
// ("12,000" -> 12000) and trimming bar-spacing suffixes ("T16-150" -> the 150
// centres are dropped, not counted as a quantity). Each number keeps whether it
// was written with a decimal point, since "12.0" (a metre length) parses to the
// integer 12 and would otherwise be indistinguishable from a bar count.
function scheduleNumbers(line: string): { value: number; decimal: boolean }[] {
  const cleaned = line
    .replace(/(\d),(\d{3})\b/g, "$1$2")
    .replace(/[-@]\s*\d{2,3}\b/g, " ");
  return [...cleaned.matchAll(/\b(\d{1,6}(?:\.\d+)?)\b/g)].map((m) => ({
    value: Number(m[0]),
    decimal: m[0].includes("."),
  }));
}

export function looksLikeBbs(lines: string[]): boolean {
  const joined = lines.join(" \n ");
  if (!BBS_MARKER.test(joined)) return false;
  const numericRows = lines.filter((l) => BAR_SIZE.test(l) && /\d{2,}/.test(l)).length;
  return numericRows >= 3;
}

// Parses a bar bending schedule line into a bar row. A BBS row carries a bar
// mark, size, number of bars and cut length; totals are the QS-standard
// length x number x mass/1000. Hooks/bends/laps are BESMM-deemed (C21), so no
// wastage factor is added. Length given in metres is scaled to mm. Returns null
// for lines that are not parseable bar rows.
function parseBarRow(line: string): BarRow | null {
  const sizeMatch = line.match(BAR_SIZE);
  if (!sizeMatch) return null;
  const sizeMm = nearestBarSize(Number(sizeMatch[1]));
  const nums = scheduleNumbers(line).filter((n) => n.value !== Number(sizeMatch[1]));
  if (nums.length < 2) return null;
  const markMatch = line.match(/\b([A-Z]{0,2}\d{1,3}[A-Z]?)\b/);

  // A decimal value is a metre length (counts and mm lengths are integers);
  // otherwise the length is the largest number. Metre lengths (<=30) scale to mm.
  const values = nums.map((n) => n.value);
  const decimal = nums.find((n) => n.decimal)?.value;
  const rawLength = decimal !== undefined ? decimal : Math.max(...values);
  let lengthMm = rawLength;
  if (lengthMm > 0 && lengthMm <= 30) lengthMm *= 1000;
  const counts = values.filter((n) => n !== rawLength && Number.isInteger(n) && n >= 1 && n <= MAX_BAR_COUNT);
  const number = counts.length > 0 ? Math.max(...counts) : 1;

  if (lengthMm < MIN_LENGTH_MM || lengthMm > MAX_LENGTH_MM) return null;
  const t = barTonnes(sizeMm, number, lengthMm);
  if (t === null) return null;
  return { barMark: markMatch ? markMatch[1]! : null, sizeMm, number, lengthMm, tonnes: t };
}

export function readBbs(lines: string[]): BbsReading | null {
  if (!looksLikeBbs(lines)) return null;
  const candidateRows = lines.filter((l) => BAR_SIZE.test(l) && /\d{2,}/.test(l)).length;
  const rows: BarRow[] = [];
  for (const line of lines) {
    const row = parseBarRow(line);
    if (row) rows.push(row);
  }
  const tonnesBySize: Record<number, number> = {};
  for (const row of rows) tonnesBySize[row.sizeMm] = (tonnesBySize[row.sizeMm] ?? 0) + row.tonnes;
  const totalTonnes = rows.reduce((s, r) => s + r.tonnes, 0);
  // Refuse rather than guess: if under two-thirds of the candidate rows parsed,
  // the tonnage is untrustworthy — flag unreadable so rebar stays provisional.
  const unreadable = rows.length < Math.ceil(candidateRows * (2 / 3)) || totalTonnes <= 0;
  return { rows, tonnesBySize, totalTonnes, unreadable, candidateRows };
}

export interface PileRow {
  pileMark: string | null;
  diameterMm: number;
  number: number;
  lengthM: number;
}

export interface PileScheduleReading {
  rows: PileRow[];
  byDiameter: Record<number, { number: number; totalLengthM: number }>;
}

const PILE_MARKER = /\b(pile\s*schedule|pile\s*layout|pile\s*mark|bored\s*pile|driven\s*pile|CFA\s*pile)\b/i;
const PILE_DIAMETER = /\b(?:dia\.?|Ø|diameter)?\s*(300|350|400|450|500|600|750|900|1000|1200)\b/;

export function looksLikePileSchedule(lines: string[]): boolean {
  const joined = lines.join(" \n ");
  if (!PILE_MARKER.test(joined)) return false;
  return lines.filter((l) => PILE_DIAMETER.test(l) && /\d/.test(l)).length >= 2;
}

function parsePileRow(line: string): PileRow | null {
  const dMatch = line.match(PILE_DIAMETER);
  if (!dMatch) return null;
  const diameterMm = Number(dMatch[1]);
  const markMatch = line.match(/\b(P\d{1,3}[A-Z]?)\b/i);
  // Read positionally: after the pile mark and the diameter column, the next
  // two numbers are the count then the cut length (mark | dia | no | length).
  const afterDia = line.slice((dMatch.index ?? 0) + dMatch[0].length);
  const trailing = [...afterDia.matchAll(/\b(\d{1,5})(?:\.\d+)?\b/g)].map((m) => Number(m[0]));
  if (trailing.length < 2) return null;
  const number = trailing[0]!;
  const lengthM = trailing[1]!;
  if (number <= 0 || lengthM <= 0 || lengthM > 120) return null;
  return { pileMark: markMatch ? markMatch[1]! : null, diameterMm, number, lengthM };
}

export function readPileSchedule(lines: string[]): PileScheduleReading | null {
  if (!looksLikePileSchedule(lines)) return null;
  const rows: PileRow[] = [];
  for (const line of lines) {
    const row = parsePileRow(line);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return null;
  const byDiameter: Record<number, { number: number; totalLengthM: number }> = {};
  for (const row of rows) {
    const entry = byDiameter[row.diameterMm] ?? { number: 0, totalLengthM: 0 };
    entry.number += row.number;
    entry.totalLengthM += row.number * row.lengthM;
    byDiameter[row.diameterMm] = entry;
  }
  return { rows, byDiameter };
}

// Emits BESMM piling items (nr enumerated + concrete length in m, by pile
// diameter) measured from a pile schedule. Only called when a real pile
// schedule is present — no schedule means NOTHING is emitted, not a guess.
export function pileScheduleToItems(reading: PileScheduleReading, pageNumber: number): MeasuredBoqItem[] {
  const items: MeasuredBoqItem[] = [];
  const diameters = Object.keys(reading.byDiameter).map(Number).sort((a, b) => a - b);
  for (const dia of diameters) {
    const { number, totalLengthM } = reading.byDiameter[dia]!;
    if (number <= 0) continue;
    const lengthM = Math.round(totalLengthM);
    items.push({
      elementGroup: "Substructure",
      workSection: { code: "1.7", title: "PILING" },
      specNote: "Reinforced concrete bored piles",
      groupHeading: "Piling",
      code: "P1",
      description: `Bored piles; ${dia}mm diameter; number stated`,
      unit: "nr",
      qtyGross: number,
      deductions: [],
      qty: number,
      confidence: "high",
      measurementBasis: `Measured from pile schedule: ${number} nr ${dia}mm piles (page ${pageNumber})`,
      geometries: [],
      pageNumber,
    });
    items.push({
      elementGroup: "Substructure",
      workSection: { code: "1.7", title: "PILING" },
      specNote: "Reinforced concrete bored piles",
      groupHeading: "Piling",
      code: "P2",
      description: `Bored piles; ${dia}mm diameter; concrete in piles`,
      unit: "m",
      qtyGross: lengthM,
      deductions: [],
      qty: lengthM,
      confidence: "high",
      measurementBasis: `Measured from pile schedule: ${lengthM}m total pile length, ${dia}mm diameter (page ${pageNumber})`,
      geometries: [],
      pageNumber,
    });
  }
  return items;
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

// Refuse-not-guess: when a BBS is present but its rows could not be parsed
// confidently, emit a flagged provisional item so rebar is visibly unresolved
// rather than silently absent from the bill.
export function provisionalRebarItem(pageNumber: number): MeasuredBoqItem {
  return {
    elementGroup: "Frame",
    workSection: { code: "1.11", title: "INSITU CONCRETE WORKS" },
    specNote: "High yield steel bar reinforcement to BS4449",
    groupHeading: "Reinforcement",
    code: "R34",
    description: "Reinforcement per bar bending schedule; schedule not machine-readable — measure manually",
    unit: "sum",
    qtyGross: 0,
    deductions: [],
    qty: 0,
    confidence: "low",
    measurementBasis: `Bar bending schedule detected on page ${pageNumber} but could not be parsed reliably; rebar tonnage left provisional for manual takeoff`,
    geometries: [],
    pageNumber,
    provisional: true,
  };
}
