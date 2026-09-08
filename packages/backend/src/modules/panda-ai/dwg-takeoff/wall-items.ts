import { levelMarks } from "./register.ts";
import type { MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";
import type { WallMeasure } from "./walls.ts";

// From measured wall runs to bill lines: storey height from the level marks,
// the thickness modes that are real walls, the opening areas to deduct, and
// the line per thickness with its basis.

export interface HeightDecision {
  mm: number;
  basis: string;
  assumed: boolean;
}

/** Storey height from consecutive floor level marks, else assumed. */
export function storeyHeight(sheets: RegisterSheet[]): HeightDecision {
  const planLevels = sheets.filter((s) => s.kind === "floor-plan" && s.levelMm !== null).map((s) => s.levelMm!);
  const fromPlans = floorToFloor(planLevels);
  if (fromPlans) return { mm: fromPlans.mm, basis: `floor-to-floor from level marks ${fromPlans.levels.map((l) => `+${l}`).join(", ")}`, assumed: false };
  // a single-storey drawing gives its height on the section or elevation:
  // "+450 GROUND FLOOR LEVEL" and "+3450 ROOF LEVEL"
  const drawn = sheets.filter((s) => s.kind === "elevation" || s.kind === "section");
  const fromViews = floorToFloor(drawn.flatMap((s) => levelMarks(s.labels).map((l) => l.mm)));
  if (fromViews) return { mm: fromViews.mm, basis: `floor-to-floor from level marks ${fromViews.levels.map((l) => `+${l}`).join(", ")} on the ${[...new Set(drawn.map((s) => s.kind))].join("/")}`, assumed: false };
  return { mm: 2700, basis: "2.7 m assumed; no floor level marks found", assumed: true };
}

function floorToFloor(levelsMm: number[]): { mm: number; levels: number[] } | null {
  const levels = [...new Set(levelsMm)].sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < levels.length; i++) diffs.push(levels[i]! - levels[i - 1]!);
  const plausible = diffs.filter((d) => d >= 2400 && d <= 6000).sort((a, b) => a - b);
  if (!plausible.length) return null;
  return { mm: plausible[plausible.length >> 1]!, levels };
}

export interface Openings {
  doors: number;
  doorWidthMm: number | null;
  windows: number;
  windowAreaM2: number | null;
}

export interface ThicknessMode {
  thicknessMm: number;
  lengthM: number;
  evidence: number[];
}

/**
 * The wall thicknesses on a sheet, longest first. A thickness that carries
 * under 5 % of the wall length is pairing noise (a nib, a pier, a frame) and
 * folds into the nearest real thickness.
 */
export function thicknessModes(measure: WallMeasure): ThicknessMode[] {
  const modes = [...measure.byThickness.entries()].map(([thicknessMm, m]) => ({ thicknessMm, lengthM: m.lengthM, evidence: [...m.evidence] }));
  const totalLen = modes.reduce((s, m) => s + m.lengthM, 0);
  if (totalLen <= 0) return [];
  const major = modes.filter((m) => m.lengthM / totalLen >= 0.05);
  if (!major.length) return modes.sort((a, b) => b.lengthM - a.lengthM);
  for (const m of modes) {
    if (major.includes(m)) continue;
    const nearest = major.reduce((a, b) => (Math.abs(b.thicknessMm - m.thicknessMm) < Math.abs(a.thicknessMm - m.thicknessMm) ? b : a));
    nearest.lengthM += m.lengthM;
    nearest.evidence.push(...m.evidence);
  }
  return major.sort((a, b) => b.lengthM - a.lengthM);
}

/** Door and window area to deduct from the wall: leaf width × 2.1 m, window schedule area. */
export function openingAreaM2(openings: Openings): number {
  const doorArea = openings.doors * ((openings.doorWidthMm ?? 900) / 1000) * 2.1;
  const windowArea = openings.windows * (openings.windowAreaM2 ?? 1.44);
  return doorArea + windowArea;
}

export function wallItems(
  measure: WallMeasure,
  height: HeightDecision,
  openings: Openings,
  sheet: RegisterSheet,
  units: UnitsDecision,
): MeasuredItem[] {
  const items: MeasuredItem[] = [];
  const modes = thicknessModes(measure);
  if (!modes.length) return items;
  const heightM = height.mm / 1000;
  const openingArea = Math.round(openingAreaM2(openings) * 100) / 100;
  // openings come out of the dominant thickness, where doors and windows live
  modes.forEach(({ thicknessMm, ...m }, idx) => {
    if (m.lengthM < 1) return;
    const gross = Math.round(m.lengthM * heightM * 100) / 100;
    const deduct = idx === 0 ? Math.min(gross * 0.6, openingArea) : 0;
    const net = Math.round((gross - deduct) * 100) / 100;
    const scaleNote = units.errorPct > 0 ? ` ±${Math.round(units.errorPct * 100)}% scale error` : "";
    items.push({
      trade: "walls",
      description: `Sandcrete block wall in cement mortar (1:6); ${thicknessMm}mm thick`,
      quantity: net,
      unit: "m2",
      confidence: height.assumed || units.errorPct > 0.1 ? "low" : "medium",
      basis:
        `${Math.round(m.lengthM * 10) / 10} m of paired ${thicknessMm}mm wall on ${sheet.code} × ${heightM} m (${height.basis})` +
        (deduct > 0 ? `; less ${deduct} m² for ${openings.doors} doors and ${openings.windows} windows` : "") +
        scaleNote,
      sheetId: sheet.id,
      evidence: [...m.evidence],
      reason: height.assumed ? "height assumed" : "thickness measured from paired faces",
      crossCheck:
        (measure.bridgedM > 0 ? `${Math.round(measure.bridgedM * 10) / 10} m of centreline runs through openings; ` : "") +
        (measure.unpairedM > 0
          ? `${Math.round(measure.unpairedM)} m of wall lines had no parallel partner and are not measured`
          : "every wall line found its partner face"),
    });
  });
  return items;
}
