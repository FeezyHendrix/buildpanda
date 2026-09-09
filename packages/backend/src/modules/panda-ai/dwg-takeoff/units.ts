import { parseLengthText } from "../geometry/length-text.ts";
import { isModelSpace, type DwgDoc, type DwgEntity } from "./dwg.ts";
import type { DrawingUnit, UnitsDecision } from "./types.ts";

// AutoCAD $INSUNITS codes that matter for a building drawing.
const INSUNITS: Record<number, DrawingUnit> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };
const TO_MM: Record<DrawingUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8, unknown: 1 };

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1] ?? 0;
};

/**
 * What one drawing unit is in millimetres, and how sure we are.
 *
 * The header says so directly when the author set it. When it does not, the
 * dimension values decide: a plan dimensioned in millimetres has values in the
 * hundreds to tens of thousands, one in metres in the units, one in
 * centimetres in between. Door leaf widths (700–1,200 mm across the world)
 * are the independent cross-check, because they exist on every plan and are
 * never ambiguous by a factor of ten. The error estimate is the spread between
 * dimension text overrides and their measured spans where overrides exist,
 * else the ambiguity that remains after the cross-check.
 */
export function inferUnits(doc: DwgDoc, doorWidthsUnits: number[] = []): UnitsDecision {
  const dims: DwgEntity[] = doc.entities.filter(
    (e) => String(e.entity ?? "").startsWith("DIMENSION") && isModelSpace(doc, e) && typeof e.act_measurement === "number" && e.act_measurement! > 0,
  );
  const values = dims.map((e) => e.act_measurement!);

  // 1. header
  const code = Number(doc.header?.["INSUNITS"]);
  const headerUnit = Number.isFinite(code) ? INSUNITS[code] : undefined;
  if (headerUnit) {
    return {
      unit: headerUnit,
      scaleToMm: TO_MM[headerUnit],
      basis: "header",
      errorPct: overrideError(dims, TO_MM[headerUnit]),
      samples: values.length,
      note: `Drawing header declares ${headerUnit} ($INSUNITS ${code}).`,
    };
  }

  // 2. dimension value distribution
  let unit: DrawingUnit = "unknown";
  let note = "";
  if (values.length >= 5) {
    const med = median(values);
    if (med >= 100) unit = "mm";
    else if (med < 50) unit = "m";
    else unit = "cm";
    note = `Median of ${values.length} dimensions is ${Math.round(med * 100) / 100}, read as ${unit}.`;
  }

  // 3. cross-check against door widths: a leaf is 700–1,200 mm in any unit system
  const doorMed = doorWidthsUnits.length >= 3 ? median(doorWidthsUnits) : null;
  if (doorMed !== null) {
    const candidates: DrawingUnit[] = ["mm", "cm", "m", "in", "ft"];
    const fits = candidates.filter((u) => {
      const mm = doorMed * TO_MM[u];
      return mm >= 650 && mm <= 1300;
    });
    if (fits.length === 1) {
      const fit = fits[0]!;
      if (unit === "unknown") {
        return { unit: fit, scaleToMm: TO_MM[fit], basis: "cross-check", errorPct: 0.05, samples: doorWidthsUnits.length, note: `No header or dimensions; door leaf widths (median ${Math.round(doorMed * 100) / 100}) fit ${fit}.` };
      }
      if (fit !== unit) {
        return { unit: fit, scaleToMm: TO_MM[fit], basis: "cross-check", errorPct: 0.1, samples: values.length, note: `${note} Door leaf widths disagree and fit ${fit}; door widths win, review the scale.` };
      }
      return { unit, scaleToMm: TO_MM[unit], basis: "dimensions", errorPct: Math.max(0.02, overrideError(dims, TO_MM[unit])), samples: values.length, note: `${note} Door leaf widths agree.` };
    }
  }

  if (unit !== "unknown") {
    return { unit, scaleToMm: TO_MM[unit], basis: "dimensions", errorPct: Math.max(0.05, overrideError(dims, TO_MM[unit])), samples: values.length, note: `${note} No independent cross-check.` };
  }
  return { unit: "mm", scaleToMm: 1, basis: "assumed", errorPct: 0.3, samples: 0, note: "No header, dimensions or door widths to read units from; millimetres assumed. Set the scale on the sheet." };
}

// Where the author typed a value over a dimension (a text override), the gap
// between the typed number and the measured span is real drawing error. A
// bare number is in drawing units; feet and inches carry their own unit.
function overrideError(dims: DwgEntity[], scaleToMm: number): number {
  const diffs: number[] = [];
  for (const d of dims) {
    const parsed = parseLengthText(String(d.user_text ?? d.text ?? d.text_value ?? ""));
    if (!parsed || !d.act_measurement) continue;
    const typed = parsed.mm !== null ? parsed.mm / scaleToMm : parsed.value;
    if (typed === null || typed <= 0) continue;
    diffs.push(Math.abs(typed - d.act_measurement) / d.act_measurement);
  }
  if (diffs.length < 3) return 0.02;
  return Math.min(0.5, Math.round(median(diffs) * 1000) / 1000 + 0.01);
}
