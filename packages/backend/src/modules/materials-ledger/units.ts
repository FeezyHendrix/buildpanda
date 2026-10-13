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

/**
 * Spellings of a material name that mean the same thing: "blocks" and
 * "block", "bags of cement" and "cement". Exact comes first so an existing
 * line is always preferred over a looser match.
 */
const PACKAGING = /^(bags?|sacks?|rolls?|sheets?|lengths?|pieces?|tonnes?|tons?) of /i;

/** "Bags of cement" is cement; the bag is the unit, not part of the name. */
export function withoutPackaging(name: string): string {
  return name.replace(PACKAGING, "");
}

export function nameVariants(normalized: string): string[] {
  const variants = [normalized];
  const bare = withoutPackaging(normalized);
  if (bare !== normalized) variants.push(bare);
  for (const name of [...variants]) {
    if (name.length > 3 && name.endsWith("s") && !name.endsWith("ss")) variants.push(name.slice(0, -1));
    else if (name.length > 2) variants.push(`${name}s`);
  }
  return [...new Set(variants)];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Whether two records name the same material, by the same rule the ledger
 * uses to pick a stock line. Approvals, orders and deliveries are typed by
 * different people; "Bags of cement" on the order is the cement that was
 * approved, so a link between them must not depend on identical spelling.
 */
export function sameMaterial(a: string, b: string): boolean {
  const left = new Set(nameVariants(normalizeName(a)));
  return nameVariants(normalizeName(b)).some((variant) => left.has(variant));
}
