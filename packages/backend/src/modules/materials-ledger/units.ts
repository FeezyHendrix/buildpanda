/**
 * One spelling per unit, so "30 bags" in and "10 bag" out land on the same
 * stock line. Voice and free typing produce plurals, capitals and shorthand;
 * the catalog is keyed on name and unit, and every spelling used to open a
 * line of its own. The canonical forms are the units the web form offers.
 */
const ALIASES: Record<string, string> = {
  each: "ea",
  pc: "ea",
  pcs: "ea",
  piece: "ea",
  pieces: "ea",
  no: "ea",
  nos: "ea",
  unit: "ea",
  units: "ea",
  bags: "bag",
  sack: "bag",
  sacks: "bag",
  rolls: "roll",
  sets: "set",
  items: "item",
  metre: "m",
  metres: "m",
  meter: "m",
  meters: "m",
  "sq m": "m2",
  sqm: "m2",
  "m²": "m2",
  "square metre": "m2",
  "square metres": "m2",
  "square meter": "m2",
  "square meters": "m2",
  "cu m": "m3",
  cum: "m3",
  "m³": "m3",
  "cubic metre": "m3",
  "cubic metres": "m3",
  "cubic meter": "m3",
  "cubic meters": "m3",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  t: "tonne",
  ton: "tonne",
  tons: "tonne",
  tonnes: "tonne",
  l: "litre",
  liter: "litre",
  liters: "litre",
  litres: "litre",
};

export function canonicalUnit(unit: string | null | undefined): string {
  const key = (unit ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  if (!key) return "item";
  return ALIASES[key] ?? key;
}

export { nameVariants, sameMaterial, withoutPackaging } from "./material-match.ts";
