// The whole of why a bill line is worth what it is, read off the records it keeps.
//
// `measurementFacts` answers "which tool, at what height" from one drawing's
// definition. That is half a basis. The figure a QS is asked to defend is
//
//     net = (gross − Σ openings) × typical
//
// taken at a stated scale, on a stated revision of the drawing. A reader given
// only the tool and the gross can see that a line bills 44 m² and that 24 m²
// was drawn, and cannot say why — the 2 m² cut-out and the ×2 repeat ARE the
// answer. Panda AI and the precon assistant were both in exactly that position,
// so both could only offer prose from `measurement_basis`, which is a sentence,
// not a record (contract 3).
//
// This composes the complete basis from the persisted facts and NOTHING else.
// Three rules it will not bend:
//
//   * Unreadable is null, never a default. A definition older code wrote that
//     this cannot parse says "no scale recorded", which is the honest answer;
//     inventing 1:100 would put an undefendable number in front of a QS.
//   * Nothing is derived from the basis sentence. Wording that differs by a
//     word would re-state a priced line.
//   * Every scale a line's drawings were taken at is reported, not whichever
//     drawing happened to be newest. A line measured across two viewports has
//     two scales and one of them is not the answer.
//
// It is deliberately a pure function over already-loaded rows, so the agent
// tool and the assistant's context build the same basis from the same code
// rather than two field lists that drift.

import { readMeasurementSettings } from "./editor-types.ts";
import { assemblySnapshotOf } from "./measurement-definition.ts";
import { measurementFacts } from "./measurement-resolve.ts";
import { DEDUCTION_MODES, type AssemblySnapshot, type DeductionMode, type MeasureTool } from "./types.ts";

/** Which scale produced a figure, and the sheet version it was true for. */
export interface BasisScale {
  source: "sheet" | "viewport";
  /** The region of the sheet the scale came from, or null for the sheet's own. */
  viewportId: string | null;
  sheetVersion: number;
  mmPerPt: number;
}

/** An opening netted off the drawn figure, as the line recorded it. */
export interface BasisDeduction {
  label: string;
  qty: number;
  /** The unit the deducted figure is in; null when the opening never recorded one. */
  unit: string | null;
  /** False means the unit was assumed rather than confirmed by a person. */
  unitConfirmed: boolean;
  mode: DeductionMode | null;
}

export interface RowBasis {
  tool: MeasureTool | null;
  heightM: number | null;
  depthM: number | null;
  /**
   * Drawn, or stated in words. Null where the line records no settings at all,
   * which is not "measured" — a non-zero `measurementCount` is what says a
   * figure was drawn.
   */
  quantityMode: "measured" | "stated" | null;
  deductions: BasisDeduction[];
  deductionsTotal: number;
  /** × identical floors or areas; 1 when the line stands for itself alone. */
  typical: number;
  /** What the QS named the repeats, when they named them. */
  repeatLabels: string[] | null;
  /** Every distinct scale the line's live drawings were taken at, newest first. */
  scales: BasisScale[];
  /** How many live drawings measure this line; `tool` describes the newest. */
  measurementCount: number;
  /** The assembly as it stood when the line was drawn — frozen, never recomputed. */
  assembly: AssemblySnapshot | null;
  /** Measured, but its basis cannot be resolved at all: needs a person, not a guess. */
  hasUnknownBasis: boolean;
}

export interface RowBasisInput {
  /** Every live measuring drawing's stored definition, newest first. */
  definitions: readonly unknown[];
  /** `precon_boq_rows.deductions` as stored. */
  deductions: unknown;
  /** `precon_boq_rows.typical` as stored. */
  typical: unknown;
  /** `precon_boq_rows.measurement_settings` as stored. */
  settings: unknown;
  measurementBasis: string | null;
}

const MODE_VALUES: readonly string[] = DEDUCTION_MODES;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** A number as pg may hand it back — numeric columns arrive as strings. */
function finite(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The scale a stored definition records, read the way a READER must.
 *
 * `asScale` in editor-types refuses a record it cannot parse, which is right on
 * the way IN — a half-valid scale must never be persisted. On the way OUT it is
 * wrong: one unreadable row would take a whole project's basis down with it. So
 * this is the lenient twin, and it returns null rather than repairing anything.
 */
function basisScaleOf(definition: unknown): BasisScale | null {
  if (typeof definition !== "object" || definition === null || Array.isArray(definition)) return null;
  const raw = (definition as { scale?: unknown }).scale;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const scale = raw as Record<string, unknown>;
  const sheetVersion = finite(scale["sheetVersion"]);
  const mmPerPt = finite(scale["appliedMmPerPt"]);
  if (sheetVersion === null || mmPerPt === null || mmPerPt <= 0) return null;
  if (scale["source"] === "sheet") return { source: "sheet", viewportId: null, sheetVersion, mmPerPt };
  const viewportId = scale["viewportId"];
  if (scale["source"] === "viewport" && typeof viewportId === "string" && viewportId.length > 0) {
    return { source: "viewport", viewportId, sheetVersion, mmPerPt };
  }
  return null;
}

/** Every distinct scale across the line's drawings, newest first, each stated once. */
function basisScales(definitions: readonly unknown[]): BasisScale[] {
  const seen = new Set<string>();
  const out: BasisScale[] = [];
  for (const definition of definitions) {
    const scale = basisScaleOf(definition);
    if (!scale) continue;
    const key = `${scale.source}|${scale.viewportId ?? ""}|${scale.sheetVersion}|${scale.mmPerPt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(scale);
  }
  return out;
}

/**
 * The openings as the row recorded them. `deductions` is jsonb older code also
 * wrote, so each entry is rebuilt field by field: a reader is handed the record,
 * never whatever happens to be in the column. An entry whose figure is not a
 * number is not an opening and is dropped rather than summed as a zero.
 */
function basisDeductions(value: unknown): BasisDeduction[] {
  if (!Array.isArray(value)) return [];
  const out: BasisDeduction[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    const qty = finite(raw["qty"]);
    if (qty === null) continue;
    const mode = raw["mode"];
    out.push({
      label: typeof raw["label"] === "string" ? raw["label"] : "",
      qty,
      unit: typeof raw["unit"] === "string" ? raw["unit"] : null,
      unitConfirmed: raw["unitConfirmed"] === true,
      mode: typeof mode === "string" && MODE_VALUES.includes(mode) ? (mode as DeductionMode) : null,
    });
  }
  return out;
}

/**
 * The line's basis, composed.
 *
 * `tool` and its factors come from the NEWEST drawing, which is the one that
 * produced the figure and the one the editor redraws from — unchanged from what
 * the read surfaces already reported. A line with no drawing falls back to the
 * figure someone STATED, because that record is just as persisted (contract 17)
 * and reporting a stated line as basis-unknown sent a QS looking for a drawing
 * that was never meant to exist.
 */
export function rowBasis(input: RowBasisInput): RowBasis {
  const drawn = input.definitions.map(measurementFacts);
  const newest = drawn[0] && drawn[0].tool !== null ? drawn[0] : null;
  const settings = readMeasurementSettings(input.settings);
  const stated = settings?.statedQuantity ?? null;

  const tool = newest?.tool ?? stated?.tool ?? null;
  const deductions = basisDeductions(input.deductions);
  const typical = finite(input.typical);

  return {
    tool,
    heightM: newest ? newest.heightM : (stated?.factor?.heightM ?? null),
    depthM: newest ? newest.depthM : (stated?.factor?.depthM ?? null),
    quantityMode: settings?.quantityMode ?? null,
    deductions,
    deductionsTotal: round2(deductions.reduce((sum, entry) => sum + entry.qty, 0)),
    typical: typical !== null && typical >= 1 ? typical : 1,
    repeatLabels: settings?.repeatLabels ?? null,
    scales: basisScales(input.definitions),
    measurementCount: input.definitions.length,
    assembly: assemblySnapshotOf(input.definitions[0]) ?? null,
    hasUnknownBasis: tool === null && Boolean(input.measurementBasis),
  };
}
