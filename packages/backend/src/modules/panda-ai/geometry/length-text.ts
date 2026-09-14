// What a length reads as when an operator typed it: a bare number in the
// drawing's unit, or feet and inches. Shared by both engines so a dimension
// override, a level mark and a PDF dimension string all parse the same way.

export const MM_PER_INCH = 25.4;

export interface LengthText {
  // the number as typed, in whatever unit the drawing uses (null for imperial)
  value: number | null;
  // millimetres, known only when the text carries its own unit (feet/inches)
  mm: number | null;
  imperial: boolean;
}

// 14'-9 1/8"   9'-10"   4'   30"   12' 6"   1'-5 3/4"
const FEET_INCHES = /^(?:(\d+)')\s*-?\s*(?:(\d+)(?:\s+(\d+)\/(\d+))?")?$|^(\d+)(?:\s+(\d+)\/(\d+))?"$/;
// 4500   4,500   4.50   4500mm   4.5m
const METRIC = /^([0-9][0-9,]*(?:\.\d+)?)\s*(mm|m)?$/i;

export function parseLengthText(raw: string): LengthText | null {
  const text = raw.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  const imp = text.match(FEET_INCHES);
  if (imp) {
    const feet = imp[1] ? Number(imp[1]) : 0;
    const inches = imp[2] ? Number(imp[2]) : imp[5] ? Number(imp[5]) : 0;
    const num = imp[3] ?? imp[6];
    const den = imp[4] ?? imp[7];
    const frac = num && den ? Number(num) / Number(den) : 0;
    const totalInches = feet * 12 + inches + frac;
    if (!Number.isFinite(totalInches) || totalInches <= 0) return null;
    return { value: null, mm: totalInches * MM_PER_INCH, imperial: true };
  }
  const met = text.match(METRIC);
  if (!met) return null;
  const value = Number(met[1]!.replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = met[2]?.toLowerCase();
  return { value, mm: unit === "mm" ? value : unit === "m" ? value * 1000 : null, imperial: false };
}

// A signed level mark: "+3450", "+3450 FIRST FLOOR SLAB", "-150", "+11'-3 7/8" FIRST FLOOR",
// "FFL +3.450". Returns millimetres and whatever text follows the number.
const LEVEL = /(?:^|[\s(])([+\-−±])\s?(\d+'-\d+(?:\s\d+\/\d+)?"|\d+"|\d{1,3}[.,]\d{3}|\d{2,6})(?=$|[\s)])(.*)$/;

export function parseLevelMark(text: string): { mm: number; rest: string } | null {
  const m = text.match(LEVEL);
  if (!m) return null;
  const raw = m[2]!;
  let mm: number;
  if (/['"]/.test(raw)) {
    const parsed = parseLengthText(raw);
    if (!parsed?.mm) return null;
    mm = Math.round(parsed.mm);
  } else if (/[.,]/.test(raw)) mm = Math.round(Number(raw.replace(",", ".")) * 1000);
  else mm = Number(raw);
  if (!Number.isFinite(mm)) return null;
  const sign = m[1] === "-" || m[1] === "−" ? -1 : 1;
  return { mm: sign * mm, rest: (m[3] ?? "").trim() };
}
