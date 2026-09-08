import type { MeasuredItem } from "../dwg-takeoff/types.ts";
import type { MeasuredBoqItem } from "../pdf-takeoff/types.ts";
import type { Truth, TruthElement, TruthElementKind } from "./types.ts";

// Scores what an engine produced against the truth manifest. Counts must be
// exact; areas within 2 %; lengths within 3 %. A failure is "flagged" when the
// engine itself marked the line below high confidence, "silent" when it
// reported the wrong figure confidently, and "missing" when it produced no
// line for an element the drawing contains.

export const TOLERANCE = { count: 0, area: 0.02, length: 0.03 } as const;

export type Outcome = "within" | "flagged" | "silent" | "missing";

export interface Scored {
  sheet: string;
  element: TruthElementKind;
  measure: "count" | "areaM2" | "lengthM";
  truth: number;
  measured: number | null;
  errorPct: number | null;
  outcome: Outcome;
  confidence: string | null;
  basis: string | null;
}

interface Candidate {
  quantity: number;
  unit: string;
  confidence: string;
  basis: string;
}

function within(measure: Scored["measure"], truth: number, measured: number): boolean {
  if (measure === "count") return measured === truth;
  const tol = measure === "areaM2" ? TOLERANCE.area : TOLERANCE.length;
  return truth === 0 ? measured === 0 : Math.abs(measured - truth) / truth <= tol;
}

function score(el: TruthElement, measure: Scored["measure"], truth: number, cand: Candidate | null): Scored {
  if (!cand) return { sheet: el.sheet, element: el.element, measure, truth, measured: null, errorPct: null, outcome: "missing", confidence: null, basis: null };
  const ok = within(measure, truth, cand.quantity);
  const errorPct = truth === 0 ? null : Math.round(((cand.quantity - truth) / truth) * 1000) / 10;
  return {
    sheet: el.sheet,
    element: el.element,
    measure,
    truth,
    measured: cand.quantity,
    errorPct,
    outcome: ok ? "within" : cand.confidence === "high" ? "silent" : "flagged",
    confidence: cand.confidence,
    basis: cand.basis,
  };
}

// The DWG engine measures one representative plan: score it against the first
// floor-plan sheet; wall areas are compared as the sum of external + internal.
export function scoreDwg(truth: Truth, items: MeasuredItem[]): Scored[] {
  const plan = truth.sheets.find((s) => s.kind === "floor-plan");
  if (!plan) return [];
  const els = truth.elements.filter((e) => e.sheet === plan.id);
  const byTrade = (trade: string): Candidate | null => {
    const it = items.find((i) => i.trade === trade);
    return it ? { quantity: it.quantity, unit: it.unit, confidence: it.confidence, basis: it.basis } : null;
  };
  const out: Scored[] = [];
  const ext = els.find((e) => e.element === "walls-external");
  const int = els.find((e) => e.element === "walls-internal");
  if (ext && int) {
    const walls = byTrade("walls");
    out.push(score({ ...ext, element: "walls-external" }, "areaM2", (ext.areaM2 ?? 0) + (int.areaM2 ?? 0), walls));
  }
  for (const [kind, trade] of [["columns", "columns"], ["doors", "doors"], ["windows", "windows"], ["sanitary", "sanitary"]] as const) {
    const el = els.find((e) => e.element === kind);
    if (el?.count !== undefined) out.push(score(el, "count", el.count, byTrade(trade)));
  }
  const floor = els.find((e) => e.element === "floor-area");
  if (floor?.areaM2 !== undefined) out.push(score(floor, "areaM2", floor.areaM2, null));
  return out;
}

// The PDF engine measures per page; page N is truth sheet N in drawing order.
export function scorePdf(truth: Truth, pages: { pageNumber: number; items: MeasuredBoqItem[] }[]): Scored[] {
  const out: Scored[] = [];
  truth.sheets.forEach((sheet, index) => {
    if (sheet.kind !== "floor-plan") return;
    const page = pages.find((p) => p.pageNumber === index + 1);
    const items = page?.items ?? [];
    const els = truth.elements.filter((e) => e.sheet === sheet.id);
    const cand = (pred: (i: MeasuredBoqItem) => boolean): Candidate | null => {
      const matches = items.filter(pred);
      if (matches.length === 0) return null;
      const quantity = matches.reduce((a, i) => a + i.qty, 0);
      const low = matches.some((i) => i.confidence !== "high");
      return { quantity, unit: matches[0]!.unit, confidence: low ? "low" : "high", basis: matches.map((i) => i.measurementBasis).join(" / ") };
    };
    const ext = els.find((e) => e.element === "walls-external");
    const int = els.find((e) => e.element === "walls-internal");
    if (ext && int) {
      out.push(score(ext, "areaM2", (ext.areaM2 ?? 0) + (int.areaM2 ?? 0), cand((i) => /wall/i.test(i.elementGroup) && i.unit === "m2" && !/finish/i.test(i.elementGroup))));
    }
    const doors = els.find((e) => e.element === "doors");
    if (doors?.count !== undefined) out.push(score(doors, "count", doors.count, cand((i) => /door/i.test(i.elementGroup) && i.unit === "nr")));
    const windows = els.find((e) => e.element === "windows");
    if (windows?.count !== undefined) out.push(score(windows, "count", windows.count, cand((i) => /window/i.test(i.elementGroup) && i.unit === "nr")));
    const columns = els.find((e) => e.element === "columns");
    if (columns?.count !== undefined) out.push(score(columns, "count", columns.count, cand((i) => /column|frame/i.test(i.elementGroup) && i.unit === "nr")));
    const floor = els.find((e) => e.element === "floor-area");
    if (floor?.areaM2 !== undefined) out.push(score(floor, "areaM2", floor.areaM2, cand((i) => /floor finish/i.test(i.elementGroup) && /screed/i.test(i.description) && i.unit === "m2")));
  });
  return out;
}

export interface Summary {
  lines: number;
  within: number;
  flagged: number;
  silent: number;
  missing: number;
  withinShare: number;
  failuresFlaggedShare: number;
}

export function summarise(scored: Scored[]): Summary {
  const count = (o: Outcome) => scored.filter((s) => s.outcome === o).length;
  const within = count("within");
  const flagged = count("flagged");
  const silent = count("silent");
  const missing = count("missing");
  const failures = flagged + silent + missing;
  return {
    lines: scored.length,
    within,
    flagged,
    silent,
    missing,
    withinShare: scored.length ? Math.round((within / scored.length) * 1000) / 10 : 0,
    failuresFlaggedShare: failures ? Math.round((flagged / failures) * 1000) / 10 : 0,
  };
}
